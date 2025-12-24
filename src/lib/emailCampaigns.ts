import { supabase } from './supabase';
import { sendEmail } from './resend';

interface SendCampaignParams {
  campaignId: string;
  templateHtml: string;
  subject: string;
  contactIds: string[];
}

export async function sendCampaign({
  campaignId,
  templateHtml,
  subject,
  contactIds,
}: SendCampaignParams) {
  try {
    // Obtener contactos
    const { data: contacts, error: contactsError } = await supabase
      .from('email_contacts')
      .select('*')
      .in('id', contactIds)
      .eq('status', 'active');

    if (contactsError) throw contactsError;
    if (!contacts || contacts.length === 0) {
      throw new Error('No hay contactos activos para enviar');
    }

    // Actualizar campaña a "sending"
    await supabase
      .from('email_campaigns')
      .update({
        status: 'sending',
        total_recipients: contacts.length,
      })
      .eq('id', campaignId);

    let sentCount = 0;
    let failedCount = 0;

    // Enviar emails uno por uno
    for (const contact of contacts) {
      try {
        // Personalizar HTML con nombre del contacto si está disponible
        const personalizedHtml = templateHtml.replace(
          /\{\{name\}\}/g,
          contact.name || 'Suscriptor'
        );

        const result = await sendEmail({
          to: contact.email,
          subject,
          html: personalizedHtml,
        });

        if (result.success && result.data) {
          // Registrar envío exitoso
          const resendId = 'id' in result.data ? result.data.id : undefined;
          const { data: _insertData, error: insertError } = await supabase.from('email_sends').insert([
            {
              campaign_id: campaignId,
              contact_id: contact.id,
              email: contact.email,
              status: 'sent',
              resend_id: resendId,
              sent_at: new Date().toISOString(),
            },
          ]).select();
          if (insertError) {
            console.error('❌ Error al insertar email_sends (UI sent):', insertError);
          }

          sentCount++;
        } else {
          throw new Error('Error enviando email');
        }
      } catch (error) {
        console.error(`Error enviando a ${contact.email}:`, error);
        
        // Registrar fallo
        const { data: _insertFailData, error: insertFailError } = await supabase.from('email_sends').insert([
          {
            campaign_id: campaignId,
            contact_id: contact.id,
            email: contact.email,
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Error desconocido',
          },
        ]).select();
        if (insertFailError) {
          console.error('❌ Error al insertar email_sends (UI failed):', insertFailError);
        }

        failedCount++;
      }

      // Actualizar progreso cada 10 emails
      if ((sentCount + failedCount) % 10 === 0) {
        await supabase
          .from('email_campaigns')
          .update({ sent_count: sentCount })
          .eq('id', campaignId);
      }
    }

    // Actualizar estado final de campaña
    await supabase
      .from('email_campaigns')
      .update({
        status: failedCount === contacts.length ? 'failed' : 'sent',
        sent_count: sentCount,
      })
      .eq('id', campaignId);

    return {
      success: true,
      sentCount,
      failedCount,
      totalContacts: contacts.length,
    };
  } catch (error) {
    console.error('Error en sendCampaign:', error);

    // Marcar campaña como fallida
    await supabase
      .from('email_campaigns')
      .update({ status: 'failed' })
      .eq('id', campaignId);

    throw error;
  }
}

export async function createCampaign(data: {
  name: string;
  subject: string;
  html_content: string;
  template_id?: string;
}) {
  const { data: campaign, error } = await supabase
    .from('email_campaigns')
    .insert([
      {
        ...data,
        status: 'draft',
        total_recipients: 0,
        sent_count: 0,
        opened_count: 0,
        clicked_count: 0,
        bounced_count: 0,
        delivered_count: 0,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return campaign;
}

export async function updateCampaignStats(campaignId: string) {
  // Obtener estadísticas de email_sends
  const { data: sends } = await supabase
    .from('email_sends')
    .select('status, opened_at, clicked_at, bounced_at, delivered_at')
    .eq('campaign_id', campaignId);

  if (!sends) return;

  const stats = {
    sent_count: sends.filter((s) => s.status === 'sent').length,
    delivered_count: sends.filter((s) => s.delivered_at).length,
    opened_count: sends.filter((s) => s.opened_at).length,
    clicked_count: sends.filter((s) => s.clicked_at).length,
    bounced_count: sends.filter((s) => s.bounced_at).length,
  };

  await supabase
    .from('email_campaigns')
    .update(stats)
    .eq('id', campaignId);

  return stats;
}

export async function getCampaignDetails(campaignId: string) {
  const { data: campaign, error: campaignError } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaignError) throw campaignError;

  const { data: sends, error: sendsError } = await supabase
    .from('email_sends')
    .select('*, email_contacts(*)')
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false });

  if (sendsError) throw sendsError;

  return {
    campaign,
    sends: sends || [],
  };
}

export async function importContactsFromCSV(csvData: string) {
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  
  const emailIndex = headers.findIndex(
    (h) => h.toLowerCase() === 'email' || h.toLowerCase() === 'correo'
  );
  const nameIndex = headers.findIndex(
    (h) => h.toLowerCase() === 'name' || h.toLowerCase() === 'nombre'
  );

  if (emailIndex === -1) {
    throw new Error('El CSV debe contener una columna "email" o "correo"');
  }

  const contacts = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const email = values[emailIndex];
    
    if (!email || !email.includes('@')) continue;

    contacts.push({
      email,
      name: nameIndex !== -1 ? values[nameIndex] : null,
      status: 'active',
    });
  }

  if (contacts.length === 0) {
    throw new Error('No se encontraron contactos válidos en el CSV');
  }

  const { data, error } = await supabase
    .from('email_contacts')
    .insert(contacts)
    .select();

  if (error) throw error;

  return {
    imported: data?.length || 0,
    total: contacts.length,
  };
}

export async function exportContactsToCSV() {
  const { data: contacts, error } = await supabase
    .from('email_contacts')
    .select('email, name, status, subscribed_at')
    .order('subscribed_at', { ascending: false });

  if (error) throw error;
  if (!contacts) return '';

  const headers = 'Email,Nombre,Estado,Fecha de Suscripción\n';
  const rows = contacts
    .map(
      (c) =>
        `${c.email},${c.name || ''},${c.status},${new Date(c.subscribed_at).toLocaleDateString('es-ES')}`
    )
    .join('\n');

  return headers + rows;
}
