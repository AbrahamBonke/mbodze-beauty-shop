import { useEffect, useState } from 'react';
import { TrendingUp, Package, AlertTriangle, ShoppingCart } from 'lucide-react';
import { supabase, Product, Sale } from '../lib/supabase';
import { db } from '../lib/db';

interface DashboardStats {
  todaySales: number;
  totalProducts: number;
  lowStockCount: number;
  topSellingProducts: { name: string; quantity: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    totalProducts: 0,
    lowStockCount: 0,
    topSellingProducts: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Read from LOCAL database (works offline & online)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      // Get all sales from local DB, filter by today's date
      const allSales = await db.sales.toArray();
      const todaysSales = allSales.filter(sale => sale.sale_date >= todayIso);

      // Get all products from local DB
      const allProducts = await db.products.toArray();

      const todaySales = todaysSales.reduce((sum, sale) => sum + sale.total_price, 0);
      const totalProducts = allProducts.length;
      const lowStockCount = allProducts.filter(p => p.quantity <= p.low_stock_level).length;

      const productSales = todaysSales.reduce((acc, sale) => {
        const existing = acc.find(p => p.name === sale.product_name);
        if (existing) {
          existing.quantity += sale.quantity_sold;
        } else {
          acc.push({ name: sale.product_name, quantity: sale.quantity_sold });
        }
        return acc;
      }, [] as { name: string; quantity: number }[]);

      const topSellingProducts = productSales.sort((a, b) => b.quantity - a.quantity).slice(0, 5);

      setStats({ todaySales, totalProducts, lowStockCount, topSellingProducts });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Today's Sales",
      value: `KSh ${stats.todaySales.toFixed(2)}`,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      title: 'Products in Stock',
      value: stats.totalProducts.toString(),
      icon: Package,
      color: 'bg-purple-500',
    },
    {
      title: 'Low Stock Alerts',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      color: 'bg-orange-500',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome to MBODZE'S Beauty Shop Management</p>
        </div>

        <div>
          <button
            onClick={async () => {
              const confirmed = window.confirm('Are you sure you want to permanently delete ALL sales records? This cannot be undone.');
              if (!confirmed) return;

              try {
                setLoading(true);

                // Clear local Dexie sales
                await db.sales.clear();

                // Remove any pending mutations related to sales so they don't re-insert on next sync
                await db.mutations.where('table').equals('sales').delete();

                // If online, delete remote sales in pages to avoid large requests
                if (navigator.onLine) {
                  const pageSize = 500;
                  let from = 0;
                  while (true) {
                    const { data: ids, error: fetchErr } = await supabase
                      .from('sales')
                      .select('id')
                      .range(from, from + pageSize - 1);
                    if (fetchErr) throw fetchErr;
                    if (!ids || ids.length === 0) break;

                    const idList = ids.map((r: any) => r.id);
                    const { error: delErr } = await supabase
                      .from('sales')
                      .delete()
                      .in('id', idList);
                    if (delErr) throw delErr;

                    if (ids.length < pageSize) break;
                    from += pageSize;
                  }
                } else {
                  console.log('Offline — skipped remote sales deletion. Local sales and pending mutations cleared.');
                }

                // Refresh dashboard numbers
                await fetchDashboardData();
                alert('All sales records have been deleted locally and remotely.');
              } catch (err) {
                console.error('Error clearing sales data:', err);
                alert('Failed to clear sales data. Check console for details.');
              } finally {
                setLoading(false);
              }
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Clear Sales Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-2 mb-6">
          <ShoppingCart className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Top Selling Products (Today)</h2>
        </div>

        {stats.topSellingProducts.length > 0 ? (
          <div className="space-y-4">
            {stats.topSellingProducts.map((product, index) => (
              <div key={product.name} className="flex items-center gap-4">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-sm text-gray-500">{product.quantity} units sold</p>
                </div>
                <div className="w-32 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{
                      width: `${(product.quantity / stats.topSellingProducts[0].quantity) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No sales recorded today</p>
          </div>
        )}
      </div>
    </div>
  );
}
