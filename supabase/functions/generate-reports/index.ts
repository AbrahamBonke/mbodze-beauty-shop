import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ReportData {
  totalRevenue: number;
  totalItemsSold: number;
  numberOfTransactions: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reportType } = await req.json();

    if (!reportType || !['weekly', 'monthly'].includes(reportType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid report type. Must be weekly or monthly.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { start, end } = getDateRange(reportType);

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .gte('sale_date', start)
      .lte('sale_date', end);

    if (salesError) throw salesError;

    const totalRevenue = salesData?.reduce((sum, sale) => sum + Number(sale.total_price), 0) || 0;
    const totalItemsSold = salesData?.reduce((sum, sale) => sum + sale.quantity_sold, 0) || 0;
    const numberOfTransactions = salesData?.length || 0;

    const reportMessage = `${reportType === 'weekly' ? 'Weekly' : 'Monthly'} Report Generated:\n` +
      `Period: ${formatDate(start)} - ${formatDate(end)}\n` +
      `Total Revenue: $${totalRevenue.toFixed(2)}\n` +
      `Items Sold: ${totalItemsSold}\n` +
      `Transactions: ${numberOfTransactions}`;

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        type: `${reportType}_report`,
        message: reportMessage,
        cleared: false,
      });

    if (notificationError) throw notificationError;

    return new Response(
      JSON.stringify({
        success: true,
        message: `${reportType} report generated successfully`,
        data: {
          totalRevenue,
          totalItemsSold,
          numberOfTransactions,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getDateRange(type: string): { start: string; end: string } {
  const now = new Date();
  const start = new Date();

  if (type === 'weekly') {
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    now.setHours(23, 59, 59, 999);
  } else {
    start.setMonth(start.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    now.setMonth(now.getMonth() + 1, 0);
    now.setHours(23, 59, 59, 999);
  }

  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
