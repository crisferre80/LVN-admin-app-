import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WelcomeEmailProps {
  name: string;
  email: string;
}

export const WelcomeEmail = ({ name }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>¡Bienvenido a La Voz del Norte Diario!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>¡Bienvenido! 👋</Heading>
        </Section>

        <Section style={content}>
          <Text style={paragraph}>Hola {name},</Text>
          <Text style={paragraph}>
            Gracias por suscribirte a <strong>La Voz del Norte Diario</strong>. 
            Estamos emocionados de tenerte en nuestra comunidad.
          </Text>
          <Text style={paragraph}>
            A partir de ahora recibirás las noticias más importantes de Santiago del Estero
            directamente en tu correo electrónico.
          </Text>
          <Text style={paragraph}>
            ¿Qué puedes esperar?
          </Text>
          <ul style={list}>
            <li style={listItem}>📰 Noticias locales actualizadas</li>
            <li style={listItem}>🎯 Contenido seleccionado según tus intereses</li>
            <li style={listItem}>⚡ Alertas de última hora</li>
            <li style={listItem}>📊 Análisis y reportajes especiales</li>
          </ul>
          <Text style={paragraph}>
            Si tienes alguna pregunta o sugerencia, no dudes en contactarnos.
          </Text>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            © 2025 La Voz del Norte Diario
          </Text>
          <Text style={footerText}>
            <Link href="https://lavozdelnortediario.com.com.ar" style={footerLink}>
              Visitar sitio web
            </Link>
            {' | '}
            <Link href="mailto:info@lavozdelnortediario.com.com.ar" style={footerLink}>
              Contacto
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  backgroundColor: '#10b981',
  padding: '40px 20px',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0',
};

const content = {
  padding: '32px',
};

const paragraph = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const list = {
  margin: '0 0 16px',
  padding: '0 0 0 20px',
};

const listItem = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '28px',
  margin: '8px 0',
};

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
  borderTop: '1px solid #e5e7eb',
};

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '8px 0',
};

const footerLink = {
  color: '#1e40af',
  textDecoration: 'none',
};

export default WelcomeEmail;
