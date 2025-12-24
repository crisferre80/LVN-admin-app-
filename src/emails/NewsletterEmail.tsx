import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface NewsletterEmailProps {
  articles: Array<{
    title: string;
    summary: string;
    image_url?: string;
    category: string;
    url: string;
  }>;
  subscriberName?: string;
}

export const NewsletterEmail = ({
  articles,
  subscriberName = 'Lector',
}: NewsletterEmailProps) => (
  <Html>
    <Head />
    <Preview>📰 Últimas noticias de La Voz del Norte Diario</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Heading style={h1}>📰 La Voz del Norte Diario</Heading>
          <Text style={subtitle}>Las noticias más importantes del día</Text>
        </Section>

        {/* Saludo */}
        <Section style={greeting}>
          <Text style={greetingText}>Hola {subscriberName},</Text>
          <Text style={greetingText}>
            Aquí están las últimas noticias seleccionadas para ti:
          </Text>
        </Section>

        {/* Artículos */}
        {articles.map((article, index) => (
          <Section key={index} style={articleSection}>
            {article.image_url && (
              <Img
                src={article.image_url}
                alt={article.title}
                style={articleImage}
              />
            )}
            <Text style={categoryBadge}>{article.category}</Text>
            <Heading style={articleTitle}>{article.title}</Heading>
            <Text style={articleSummary}>{article.summary}</Text>
            <Link href={article.url} style={readMoreLink}>
              Leer más →
            </Link>
          </Section>
        ))}

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            © 2025 La Voz del Norte Diario. Todos los derechos reservados.
          </Text>
          <Text style={footerText}>
            <Link href="https://lavozdelnortediario.com.com.ar" style={footerLink}>
              Visitar sitio web
            </Link>
            {' | '}
            <Link href="mailto:info@lavozdelnortediario.com.com.ar" style={footerLink}>
              Contacto
            </Link>
            {' | '}
            <Link href="#" style={footerLink}>
              Cancelar suscripción
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

// Estilos
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
  backgroundColor: '#1e40af',
  padding: '20px',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
};

const subtitle = {
  color: '#e0e7ff',
  fontSize: '16px',
  margin: '8px 0 0',
};

const greeting = {
  padding: '24px',
};

const greetingText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const articleSection = {
  padding: '24px',
  borderBottom: '1px solid #e5e7eb',
};

const articleImage = {
  width: '100%',
  borderRadius: '8px',
  marginBottom: '16px',
};

const categoryBadge = {
  display: 'inline-block',
  backgroundColor: '#dbeafe',
  color: '#1e40af',
  fontSize: '12px',
  fontWeight: '600',
  padding: '4px 12px',
  borderRadius: '12px',
  marginBottom: '12px',
};

const articleTitle = {
  color: '#111827',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 12px',
  lineHeight: '28px',
};

const articleSummary = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 16px',
};

const readMoreLink = {
  color: '#1e40af',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
};

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
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

export default NewsletterEmail;
