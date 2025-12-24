import { supabase } from './supabase';

// Configuración de email por defecto
export const emailConfig = {
  from: import.meta.env.VITE_EMAIL_FROM || 'noreply@lavozdelnortediario.com.com.ar',
  fromName: import.meta.env.VITE_EMAIL_FROM_NAME || 'La Voz del Norte Diario',
};

// Tipos de emails
export interface EmailData {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
  }>;
}

// Función para enviar emails usando Edge Function
export async function sendEmail(data: EmailData) {
  try {
    console.log('📧 Llamando a Edge Function send-email...', {
      to: data.to,
      subject: data.subject,
      htmlLength: data.html.length
    });

    const { data: result, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: data.to,
        subject: data.subject,
        html: data.html,
        from: emailConfig.from,
        fromName: emailConfig.fromName,
        replyTo: data.replyTo,
        cc: data.cc,
        bcc: data.bcc,
      },
    });

    if (error) {
      console.error('❌ Error desde Edge Function:', error);
      throw error;
    }

    console.log('✅ Email enviado correctamente:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error };
  }
}

// Función para enviar emails masivos usando Edge Function
export async function sendBatchEmails(templateId: string, subject: string, contactIds: string[]) {
  try {
    console.log('📧 Llamando a Edge Function send-bulk-email...', {
      templateId,
      subject,
      contactCount: contactIds.length
    });

    const { data: result, error } = await supabase.functions.invoke('send-bulk-email', {
      body: {
        templateId,
        subject,
        contactIds,
      },
    });

    if (error) {
      console.error('❌ Error desde Edge Function:', error);
      throw error;
    }

    console.log('✅ Envío masivo completado:', result);
    return { success: true, ...result };
  } catch (error) {
    console.error('❌ Error en envío masivo:', error);
    return { success: false, error };
  }
}
