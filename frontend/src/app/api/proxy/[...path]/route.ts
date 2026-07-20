import { NextRequest, NextResponse } from 'next/server';

const MAPPING: Record<string, string> = {
  knowledge: process.env.MODULE1_API_URL || 'http://localhost:8000',
  copilot: process.env.MODULE2_API_URL || 'http://localhost:8001',
  maintenance: process.env.MODULE3_API_URL || 'http://localhost:8002',
  compliance: process.env.MODULE4_API_URL || 'http://localhost:8003',
};

async function handleProxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathParts = resolvedParams.path;
  if (!pathParts || pathParts.length === 0) {
    return NextResponse.json({ error: 'Invalid api path' }, { status: 400 });
  }

  const moduleName = pathParts[0];
  const backendBaseUrl = MAPPING[moduleName];

  if (!backendBaseUrl) {
    return NextResponse.json({ error: `Backend module '${moduleName}' not found` }, { status: 404 });
  }

  // Construct backend url by joining path parts, skipping the first part (module identifier)
  const relativePath = pathParts.slice(1).join('/');
  const queryStr = req.nextUrl.search;
  const targetUrl = `${backendBaseUrl}/${relativePath}${queryStr}`;

  console.log(`BFF Proxy: ${req.method} ${req.nextUrl.pathname} -> ${targetUrl}`);

  try {
    const headers = new Headers();

    // Copy incoming headers
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Skip host headers to avoid target confusion
      if (lowerKey !== 'host') {
        headers.set(key, value);
      }
    });
    headers.set('X-API-Key', process.env.GLOBAL_API_KEY || 'et_brain_secure_key_2026_xyz');

    const options: RequestInit = {
      method: req.method,
      headers: headers,
    };

    // Include body for mutation methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('multipart/form-data')) {
        // Forward raw request body stream directly to avoid parsing in proxy memory
        options.body = req.body || undefined;
        // Node.js native fetch requires duplex to be set to 'half' when body is a stream
        (options as any).duplex = 'half';
      } else {
        const bodyText = await req.text();
        if (bodyText) {
          options.body = bodyText;
        }
      }
    }

    const response = await fetch(targetUrl, options);
    const responseText = await response.text();

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch {
      jsonResponse = { raw: responseText };
    }

    return NextResponse.json(jsonResponse, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    console.error(`BFF Proxy failed: ${error.message}`);
    return NextResponse.json(
      { error: 'BFF Proxy failed to contact backend', details: error.message },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
