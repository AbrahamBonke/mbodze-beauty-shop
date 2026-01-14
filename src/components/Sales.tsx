import { useEffect, useState } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, DollarSign, Package } from 'lucide-react';
import { supabase, Product, CartItem } from '../lib/supabase';
import { getProductImages } from '../lib/imageManager';
import { db } from '../lib/db';
import { enqueueMutation } from '../lib/offlineQueue';
import { useData } from '../contexts/DataContext';
import { useRef } from 'react';

export default function Sales() {
  const { products: contextProducts, productsLoaded, reloadProducts } = useData();
  const [products, setProducts] = useState<Product[]>([]);
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string[]>>({});
  const [imageIndexMap, setImageIndexMap] = useState<Record<string, number>>({});
  const createdObjectUrls = useRef<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Use products from DataContext on load, then update from local DB
  useEffect(() => {
    if (productsLoaded && contextProducts.length > 0) {
      setProducts(contextProducts as any);
      setLoading(false);
    } else {
      fetchProducts();
    }
  }, [productsLoaded, contextProducts]);

  useEffect(() => {
    let mounted = true;
    const loadImages = async () => {
      const map: Record<string, string[]> = {};
      const indexMap: Record<string, number> = {};
      for (const p of products) {
        try {
          const imgs = await getProductImages(p.id);
          if (imgs && imgs.length > 0) {
            const urls: string[] = [];
            for (const img of imgs) {
              if ((img as any).blob) {
                const url = URL.createObjectURL((img as any).blob as Blob);
                createdObjectUrls.current.push(url);
                urls.push(url);
              } else if (img.remote_url) {
                urls.push(img.remote_url);
              } else if (img.local_path) {
                urls.push(img.local_path);
              }
            }
            map[p.id] = urls;
            indexMap[p.id] = 0;
          }
        } catch (e) {
          console.error('Error loading product images for', p.id, e);
        }
      }
      if (mounted) {
        setImageUrlMap(map);
        setImageIndexMap(indexMap);
      }
    };
    loadImages();

    return () => {
      mounted = false;
      // revoke created urls
      createdObjectUrls.current.forEach((u) => URL.revokeObjectURL(u));
      createdObjectUrls.current = [];
    };
  }, [products]);

  const fetchProducts = async () => {
    try {
      // Read from LOCAL database (works offline & online)
      const localProducts = await db.products.toArray();
      // Sort by name for consistency
      const sorted = localProducts.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(sorted as any);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      alert('Product is out of stock!');
      return;
    }

    const existingItem = cart.find((item) => item.product.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.quantity) {
        alert('Cannot add more than available stock!');
        return;
      }
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQuantity > item.product.quantity) {
      alert('Cannot exceed available stock!');
      return;
    }

    setCart(
      cart.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }

    setProcessing(true);
    try {
      const saleDate = new Date().toISOString();

      for (const item of cart) {
        const newQuantity = item.product.quantity - item.quantity;

        // Update product quantity in LOCAL DB immediately (mark as unsynced so it gets pushed to Supabase)
        await db.products.update(item.product.id, {
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
          synced: false,
        });

        // Queue mutation to sync product update to Supabase
        await enqueueMutation('products', 'UPDATE', item.product.id, {
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        });

        // Create sale record with unique ID
        const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const saleRecord = {
          id: saleId,
          product_id: item.product.id,
          product_name: item.product.name,
          quantity_sold: item.quantity,
          unit_price: item.product.selling_price,
          total_price: item.product.selling_price * item.quantity,
          sale_date: saleDate,
          created_at: saleDate,
          synced: false,
        };

        // Add sale to LOCAL DB (initially not synced)
          await db.sales.add({
            ...saleRecord,
            synced: false,
          } as any);

          // Queue mutation to sync sale to Supabase
          await enqueueMutation('sales', 'INSERT', saleId, saleRecord);
      }

      setCart([]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      // Reload products from context to update local state
      await reloadProducts();
    } catch (error) {
      console.error('Error completing sale:', error);
      alert('Error completing sale. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const calculateTotal = () => {
    return cart.reduce(
      (sum, item) => sum + item.product.selling_price * item.quantity,
      0
    );
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading POS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row">
      <div className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Point of Sale</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => addToCart(product)}
              className={`bg-white rounded-lg shadow-sm border border-gray-100 p-3 text-left hover:shadow-md transition-shadow cursor-pointer ${
                product.quantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden">
                {imageUrlMap[product.id] && imageUrlMap[product.id].length > 0 ? (
                  <div className="w-full h-full relative">
                    <img
                      src={imageUrlMap[product.id][imageIndexMap[product.id] || 0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    {/* thumbnail strip */}
                    <div className="absolute left-0 right-0 bottom-2 flex gap-2 justify-center px-2 overflow-x-auto">
                      {imageUrlMap[product.id].map((url, i) => (
                        <button
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageIndexMap((m) => ({ ...m, [product.id]: i }));
                          }}
                          className={`w-12 h-12 rounded overflow-hidden border-2 ${
                            (imageIndexMap[product.id] || 0) === i ? 'border-white' : 'border-transparent'
                          }`}
                        >
                          <img src={url} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-300" />
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">
                {product.name}
              </h3>
              <p className="text-purple-600 font-bold text-lg">
                KSh {product.selling_price.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Stock: {product.quantity}
              </p>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No products found</p>
          </div>
        )}
      </div>

      <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col">
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Current Sale</h2>
          </div>
          <p className="text-sm text-gray-500">{cart.length} item(s)</p>
        </div>

        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">
                Select products to add to cart
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-16 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                      {imageUrlMap[item.product.id] && imageUrlMap[item.product.id].length > 0 ? (
                        <div className="w-20 h-20 relative">
                          <img
                            src={imageUrlMap[item.product.id][imageIndexMap[item.product.id] || 0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover rounded"
                          />
                        </div>
                      ) : item.product.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {item.product.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        KSh {item.product.selling_price.toFixed(2)} each
                      </p>
                      <p className="text-sm font-bold text-purple-600 mt-1">
                        KSh {(item.product.selling_price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() =>
                        updateQuantity(item.product.id, item.quantity - 1)
                      }
                      className="w-8 h-8 bg-white border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.product.id, parseInt(e.target.value) || 0)
                      }
                      className="w-16 text-center px-2 py-1 border border-gray-300 rounded"
                      min="1"
                      max={item.product.quantity}
                    />
                    <button
                      onClick={() =>
                        updateQuantity(item.product.id, item.quantity + 1)
                      }
                      className="w-8 h-8 bg-white border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="ml-auto w-8 h-8 bg-red-50 text-red-600 rounded flex items-center justify-center hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 lg:p-6">
          <div className="bg-purple-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">KSh {calculateTotal().toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold text-purple-600">
              <span>Total</span>
              <span>KSh {calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={completeSale}
            disabled={cart.length === 0 || processing}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-bold text-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <DollarSign className="w-6 h-6" />
            {processing ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-slide-in">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <span className="text-green-500 text-xl">✓</span>
          </div>
          <span className="font-semibold">Sale completed successfully!</span>
        </div>
      )}
    </div>
  );
}
