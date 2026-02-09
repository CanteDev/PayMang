import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const message = searchParams.get('message') || 'unknown_error';

    const errorMessages: Record<string, string> = {
        hotmart_not_configured: 'Hotmart no está configurado para este producto',
        sequra_not_configured: 'seQura no está configurado',
        link_not_found: 'El link de pago no existe o ya fue utilizado',
        unknown_error: 'Ha ocurrido un error inesperado',
    };

    return new NextResponse(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Error - PayMang</title>
      <style>
        body {
          font-family: 'Inter', system-ui, sans-serif;
          background-color: #F5F7FA;
          display: flex;
          align-items: center;
          justify-center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          max-width: 500px;
          text-align: center;
        }
        h1 {
          color: #EF4444;
          font-size: 24px;
          margin: 0 0 16px 0;
        }
        p {
          color: #6B7280;
          font-size: 16px;
          line-height: 1.5;
        }
        .icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">⚠️</div>
        <h1>Error de pago</h1>
        <p>${errorMessages[message]}</p>
        <p style="margin-top: 24px; font-size: 14px;">
          Si el problema persiste, contacta con soporte.
        </p>
      </div>
    </body>
    </html>
  `, {
        headers: {
            'Content-Type': 'text/html',
        },
    });
}
