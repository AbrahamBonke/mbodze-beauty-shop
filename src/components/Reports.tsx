import { useEffect, useState } from 'react';
import { FileText, TrendingUp, TrendingDown, Calendar, DollarSign, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { useData } from '../contexts/DataContext';

interface ReportData {
  totalRevenue: number;
  totalItemsSold: number;
  totalProfit: number;
  topSelling: { name: string; quantity: number; revenue: number; profit: number }[];
  slowSelling: { name: string; quantity: number }[];
  numberOfTransactions: number;
  profitByProduct: { name: string; profit: number; margin: number }[];
  salesByTime: { productName: string; saleDate: string; revenue: number; profit: number }[];
}

export default function Reports() {
  const { sales: contextSales, salesLoaded } = useData();
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reportData, setReportData] = useState<ReportData>({
    totalRevenue: 0,
    totalItemsSold: 0,
    totalProfit: 0,
    topSelling: [],
    slowSelling: [],
    numberOfTransactions: 0,
    profitByProduct: [],
    salesByTime: [],
  });
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentDate, setCurrentDate] = useState(new Date().toDateString());

  // Regenerate report when report type changes OR when sales data changes
  useEffect(() => {
    if (salesLoaded) {
      generateReport();
    }
  }, [reportType, salesLoaded, contextSales]);

  // Auto-refresh daily report at midnight
  useEffect(() => {
    if (reportType !== 'daily') return;

    const checkMidnight = setInterval(() => {
      const today = new Date().toDateString();
      if (today !== currentDate) {
        console.log('📅 Daily report refreshed at midnight');
        setCurrentDate(today);
        generateReport();
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkMidnight);
  }, [reportType, currentDate]);

  const generateReport = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(reportType);
      setDateRange({ start, end });

      // Read from LOCAL database (works offline & online)
      const allSales = await db.sales.toArray();
      const allProducts = await db.products.toArray();
      
      const salesData = allSales.filter(sale => sale.sale_date >= start && sale.sale_date <= end);

      if (!salesData || salesData.length === 0) {
        setReportData({
          totalRevenue: 0,
          totalItemsSold: 0,
          totalProfit: 0,
          topSelling: [],
          slowSelling: [],
          numberOfTransactions: 0,
          profitByProduct: [],
          salesByTime: [],
        });
        setLoading(false);
        return;
      }

      // Create product map for quick lookup
      const productMap = new Map(allProducts.map(p => [p.name, p]));

      // Calculate revenue and profit data
      const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total_price, 0);
      const totalItemsSold = salesData.reduce((sum, sale) => sum + sale.quantity_sold, 0);
      const numberOfTransactions = salesData.length;

      // Build product sales with profit calculation
      const productSales = salesData.reduce((acc, sale) => {
        const product = productMap.get(sale.product_name);
        const buyingPrice = product?.buying_price || 0;
        const costOfSale = buyingPrice * sale.quantity_sold;
        const profit = sale.total_price - costOfSale;

        const existing = acc.find(p => p.name === sale.product_name);
        if (existing) {
          existing.quantity += sale.quantity_sold;
          existing.revenue += sale.total_price;
          existing.profit += profit;
          existing.totalCost += costOfSale;
        } else {
          acc.push({
            name: sale.product_name,
            quantity: sale.quantity_sold,
            revenue: sale.total_price,
            profit: profit,
            totalCost: costOfSale,
          });
        }
        return acc;
      }, [] as { name: string; quantity: number; revenue: number; profit: number; totalCost: number }[]);

      const totalProfit = productSales.reduce((sum, p) => sum + p.profit, 0);

      // Top selling by quantity
      const topSelling = productSales
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map(p => ({
          name: p.name,
          quantity: p.quantity,
          revenue: p.revenue,
          profit: p.profit,
        }));

      // Profit by product
      const profitByProduct = productSales
        .sort((a, b) => b.profit - a.profit)
        .map(p => ({
          name: p.name,
          profit: p.profit,
          margin: p.totalCost > 0 ? (p.profit / p.revenue) * 100 : 0,
        }));

      // Slow selling products
      const soldProductNames = new Set(productSales.map(p => p.name));
      const unsoldProducts = allProducts.filter(p => !soldProductNames.has(p.name));

      const slowSelling = [
        ...productSales.sort((a, b) => a.quantity - b.quantity).slice(0, 3),
        ...unsoldProducts.map(p => ({ name: p.name, quantity: 0 })).slice(0, 2),
      ].slice(0, 5);

      // Sales by time - individual sales list with product name, time, revenue, and profit
      const salesByTime = salesData.map((sale) => {
        const product = productMap.get(sale.product_name);
        const buyingPrice = product?.buying_price || 0;
        const profit = sale.total_price - (buyingPrice * sale.quantity_sold);

        return {
          productName: sale.product_name,
          saleDate: new Date(sale.sale_date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          revenue: sale.total_price,
          profit: profit,
        };
      }).sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

      setReportData({
        totalRevenue,
        totalItemsSold,
        totalProfit,
        topSelling,
        slowSelling,
        numberOfTransactions,
        profitByProduct,
        salesByTime,
      });
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (type: 'daily' | 'weekly' | 'monthly') => {
    const now = new Date();
    const start = new Date();

    if (type === 'daily') {
      start.setHours(0, 0, 0, 0);
      now.setHours(23, 59, 59, 999);
    } else if (type === 'weekly') {
      const dayOfWeek = start.getDay();
      const diff = start.getDate() - dayOfWeek;
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      now.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      now.setMonth(now.getMonth() + 1, 0);
      now.setHours(23, 59, 59, 999);
    }

    return {
      start: start.toISOString(),
      end: now.toISOString(),
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Reports</h1>

        <div className="flex gap-2 mb-4">
          {(['daily', 'weekly', 'monthly'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                reportType === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>
            {dateRange.start && dateRange.end
              ? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
              : 'Loading...'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Generating report...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Total Revenue</p>
                <div className="bg-blue-100 p-2 rounded-lg">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                KSh {reportData.totalRevenue.toFixed(2)}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Total Profit</p>
                <div className="bg-green-100 p-2 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-green-600">
                KSh {reportData.totalProfit.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {((reportData.totalProfit / reportData.totalRevenue) * 100).toFixed(1)}% margin
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Items Sold</p>
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {reportData.totalItemsSold}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Transactions</p>
                <div className="bg-orange-100 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {reportData.numberOfTransactions}
              </p>
            </div>
          </div>

          {/* Top Selling and Slow Selling Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h2 className="text-xl font-bold text-gray-900">Top Selling Products</h2>
              </div>

              {reportData.topSelling.length > 0 ? (
                <div className="space-y-4">
                  {reportData.topSelling.map((product, index) => (
                    <div key={product.name} className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-lg flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>{product.quantity} units</span>
                          <span>•</span>
                          <span className="text-green-600 font-medium">
                            KSh {product.profit.toFixed(2)} profit
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No sales data available</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <TrendingDown className="w-5 h-5 text-orange-600" />
                <h2 className="text-xl font-bold text-gray-900">Slow Selling Products</h2>
              </div>

              {reportData.slowSelling.length > 0 ? (
                <div className="space-y-4">
                  {reportData.slowSelling.map((product, index) => (
                    <div key={product.name} className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-lg flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                        <p className="text-sm text-gray-600">
                          {product.quantity === 0
                            ? 'No sales'
                            : `${product.quantity} units sold`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Profit by Product */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6">
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">Profit by Product</h2>
            </div>

            {reportData.profitByProduct.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr className="text-left text-gray-600 font-semibold">
                      <th className="pb-3 px-0">Product</th>
                      <th className="pb-3 px-0 text-right">Profit</th>
                      <th className="pb-3 px-0 text-right">Profit Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.profitByProduct.map((product) => (
                      <tr key={product.name} className="hover:bg-gray-50">
                        <td className="py-3 px-0 font-medium text-gray-900">{product.name}</td>
                        <td className="py-3 px-0 text-right text-green-600 font-semibold">
                          KSh {product.profit.toFixed(2)}
                        </td>
                        <td className="py-3 px-0 text-right text-gray-600">
                          {product.margin.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No profit data available</p>
              </div>
            )}
          </div>

          {/* Sales by Time - Individual Sales List */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Products Sold by Time</h2>
            </div>

            {reportData.salesByTime.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr className="text-left text-gray-600 font-semibold">
                      <th className="pb-3 px-0">Product Name</th>
                      <th className="pb-3 px-0">Sale Time</th>
                      <th className="pb-3 px-0 text-right">Revenue</th>
                      <th className="pb-3 px-0 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.salesByTime.map((sale, index) => (
                      <tr key={`${sale.productName}-${sale.saleDate}-${index}`} className="hover:bg-gray-50">
                        <td className="py-3 px-0 font-medium text-gray-900">{sale.productName}</td>
                        <td className="py-3 px-0 text-gray-600">{sale.saleDate}</td>
                        <td className="py-3 px-0 text-right text-blue-600 font-medium">
                          KSh {sale.revenue.toFixed(2)}
                        </td>
                        <td className="py-3 px-0 text-right text-green-600 font-medium">
                          KSh {sale.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No sales data available</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
