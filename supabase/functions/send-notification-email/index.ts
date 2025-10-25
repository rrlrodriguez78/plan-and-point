import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  notification_type: 'new_view' | 'new_user' | 'weekly_report' | 'activity_reminder';
  recipient_email: string;
  recipient_name: string;
  data: {
    user_id?: string;
    tour_title?: string;
    tour_id?: string;
    viewed_at?: string;
    user_name?: string;
    registered_at?: string;
    stats?: any;
  };
}

// Email templates
const getNewViewEmailHtml = (data: any) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .tour-info { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Nueva Vista en tu Tour</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${data.recipient_name}</strong>,</p>
      <p>Tu tour virtual ha recibido una nueva visita!</p>
      
      <div class="tour-info">
        <h2 style="margin-top: 0; color: #6366f1;">📍 ${data.tour_title}</h2>
        <p style="margin: 5px 0;"><strong>Visto:</strong> ${new Date(data.viewed_at).toLocaleString('es-ES')}</p>
      </div>
      
      <p>¿Quieres ver más detalles sobre tus visitas?</p>
      <a href="https://app.lovable.dev/dashboard/analytics" class="button">Ver Analytics Completo</a>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        Puedes configurar tus preferencias de notificación en cualquier momento desde tu perfil.
      </p>
    </div>
    <div class="footer">
      <p>Virtual Tours Platform</p>
      <p><a href="#" style="color: #6366f1;">Desactivar notificaciones</a></p>
    </div>
  </div>
</body>
</html>
`;

const getNewUserEmailHtml = (data: any) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .welcome-box { background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0; }
    .button { display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .features { margin: 30px 0; }
    .feature { margin: 15px 0; padding-left: 25px; position: relative; }
    .feature:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 ¡Bienvenido a Virtual Tours!</h1>
    </div>
    <div class="content">
      <div class="welcome-box">
        <h2 style="margin-top: 0; color: #059669;">Hola ${data.user_name}!</h2>
        <p>Gracias por unirte a nuestra plataforma de tours virtuales. Estamos emocionados de tenerte con nosotros.</p>
      </div>
      
      <h3 style="color: #374151;">¿Qué puedes hacer ahora?</h3>
      <div class="features">
        <div class="feature">Crear tours virtuales inmersivos en minutos</div>
        <div class="feature">Agregar fotos panorámicas y puntos de interés</div>
        <div class="feature">Compartir tus tours con el mundo</div>
        <div class="feature">Ver analytics detallados de tus visitas</div>
        <div class="feature">Personalizar la apariencia de tus tours</div>
      </div>
      
      <a href="https://app.lovable.dev/dashboard" class="button">Comenzar Ahora</a>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        Si tienes alguna pregunta, no dudes en contactarnos. ¡Estamos aquí para ayudarte!
      </p>
    </div>
    <div class="footer">
      <p>Virtual Tours Platform</p>
      <p>Creado con ❤️ para creadores de contenido</p>
    </div>
  </div>
</body>
</html>
`;

const getWeeklyReportEmailHtml = (data: any) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
    .stat-card { background: #fef3c7; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #d97706; margin: 10px 0; }
    .stat-label { color: #78350f; font-size: 14px; }
    .tour-list { margin: 20px 0; }
    .tour-item { background: #f9fafb; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 3px solid #f59e0b; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Tu Reporte Semanal</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${data.recipient_name}</strong>,</p>
      <p>Aquí está el resumen de tu actividad esta semana:</p>
      
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Total de Vistas</div>
          <div class="stat-value">${data.stats?.total_views || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Visitantes Únicos</div>
          <div class="stat-value">${data.stats?.unique_visitors || 0}</div>
        </div>
      </div>
      
      ${data.stats?.top_tours?.length > 0 ? `
        <h3 style="color: #78350f;">🏆 Tus Tours Más Visitados</h3>
        <div class="tour-list">
          ${data.stats.top_tours.map((tour: any) => `
            <div class="tour-item">
              <strong>${tour.title}</strong>
              <p style="margin: 5px 0; color: #6b7280;">${tour.views} vistas</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <a href="https://app.lovable.dev/dashboard/analytics" class="button">Ver Reporte Completo</a>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        ¡Sigue creando contenido increíble! 🚀
      </p>
    </div>
    <div class="footer">
      <p>Virtual Tours Platform</p>
      <p><a href="#" style="color: #f59e0b;">Cambiar frecuencia de reportes</a></p>
    </div>
  </div>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: NotificationRequest = await req.json();
    const { notification_type, recipient_email, recipient_name, data } = body;

    console.log(`Sending ${notification_type} email to ${recipient_email}`);

    // Select email template and subject based on notification type
    let htmlContent = '';
    let subject = '';

    switch (notification_type) {
      case 'new_view':
        htmlContent = getNewViewEmailHtml({ ...data, recipient_name });
        subject = `🎉 Nueva vista en "${data.tour_title}"`;
        break;
      case 'new_user':
        htmlContent = getNewUserEmailHtml({ ...data, user_name: recipient_name });
        subject = '🎉 ¡Bienvenido a Virtual Tours!';
        break;
      case 'weekly_report':
        htmlContent = getWeeklyReportEmailHtml({ ...data, recipient_name });
        subject = '📊 Tu Reporte Semanal de Virtual Tours';
        break;
      default:
        throw new Error(`Unknown notification type: ${notification_type}`);
    }

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: 'Virtual Tours <onboarding@resend.dev>',
      to: [recipient_email],
      subject: subject,
      html: htmlContent,
    });

    console.log('Email sent successfully:', emailResponse);

    // Get email ID (Resend 4.0.0 returns { data: { id } })
    const emailId = (emailResponse as any).data?.id || (emailResponse as any).id;

    // Log email sending attempt
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        user_id: data.user_id,
        notification_type,
        email_address: recipient_email,
        status: 'sent',
        resend_id: emailId,
        metadata: { data }
      });

    if (logError) {
      console.error('Error logging email:', logError);
    }

    return new Response(
      JSON.stringify({ success: true, email_id: emailId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending notification email:", error);

    // Try to log the error
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from('email_logs')
        .insert({
          notification_type: 'unknown',
          email_address: 'unknown',
          status: 'failed',
          error_message: error.message,
        });
    } catch (logError) {
      console.error('Error logging failed email:', logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
