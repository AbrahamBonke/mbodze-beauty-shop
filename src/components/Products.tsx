import { useEffect, useState } from 'react';
import { Plus, Edit, Package, Search, AlertCircle, CheckCircle, Trash2, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { supabase, Product } from '../lib/supabase';
import { enqueueMutation } from '../lib/offlineQueue';
import { db } from '../lib/db';
import { storeLocalImage, getProductImages, getLocalImageUrl, deleteLocalImage } from '../lib/imageManager';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockModal, setRestockModal] = useState<Product | null>(null);
  const [restockQuantity, setRestockQuantity] = useState('');
  const [deleteModal, setDeleteModal] = useState<Product | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, any[]>>({});
  const [imageIndexMap, setImageIndexMap] = useState<Record<string, number>>({});

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    buying_price: '',
    selling_price: '',
    quantity: '',
    image_url: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    // load local images for current products
    const loadAllImages = async () => {
      const map: Record<string, any[]> = {};
      for (const p of products) {
        const imgs = await getProductImages(p.id);
        map[p.id] = imgs || [];
      }
      setImageMap(map);
    };
    loadAllImages();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isOnline = navigator.onLine;

      if (isOnline) {
        // Online: try to write to Supabase with timeout, fallback to offline mode if fails
        try {
          if (editingProduct) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const { data, error } = await supabase
              .from('products')
              .update({
                name: formData.name,
                category: formData.category,
                buying_price: Number(formData.buying_price),
                selling_price: Number(formData.selling_price),
                quantity: Number(formData.quantity),
                image_url: formData.image_url,
              })
              .eq('id', editingProduct.id)
              .select();

            clearTimeout(timeoutId);

            if (error) throw error;

            // mirror to local DB as synced
            await db.products.put({
              id: editingProduct.id,
              name: formData.name,
              category: formData.category,
              buying_price: Number(formData.buying_price),
              selling_price: Number(formData.selling_price),
              quantity: Number(formData.quantity),
              low_stock_level: editingProduct.low_stock_level || 7,
              image_url: formData.image_url,
              created_at: editingProduct.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              synced: true,
            });

            if (selectedFiles.length > 0) {
              for (const f of selectedFiles) {
                await storeLocalImage(editingProduct.id, f);
              }
            }
          } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const { data, error } = await supabase
              .from('products')
              .insert({
                name: formData.name,
                category: formData.category,
                buying_price: Number(formData.buying_price),
                selling_price: Number(formData.selling_price),
                quantity: Number(formData.quantity),
                image_url: formData.image_url,
                low_stock_level: 7,
              })
              .select();

            clearTimeout(timeoutId);

            if (error) throw error;

            const newProductId = data && data[0] && data[0].id;
            if (newProductId) {
              // mirror to local DB
              await db.products.put({
                id: newProductId,
                name: formData.name,
                category: formData.category,
                buying_price: Number(formData.buying_price),
                selling_price: Number(formData.selling_price),
                quantity: Number(formData.quantity),
                low_stock_level: 7,
                image_url: formData.image_url,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                synced: true,
              });

              if (selectedFiles.length > 0) {
                for (const f of selectedFiles) {
                  await storeLocalImage(newProductId, f);
                }
              }
            }
          }
        } catch (networkError) {
          // Network failed even though navigator.onLine is true, fallback to offline mode
          console.warn('⚠️ Network unavailable, saving offline instead:', networkError);
          throw new Error('FALLBACK_TO_OFFLINE');
        }
      } else {
        throw new Error('OFFLINE');
      }

      // refresh UI on success
      resetForm();
      setSelectedFiles([]);
      setPreviewUrls([]);
      fetchProducts();
    } catch (error) {
      // If online failed or explicitly offline, save locally
      if (error instanceof Error && (error.message === 'FALLBACK_TO_OFFLINE' || error.message === 'OFFLINE')) {
        try {
          const localId = editingProduct?.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const now = new Date().toISOString();

          const productRecord = {
            id: localId,
            name: formData.name,
            category: formData.category,
            buying_price: Number(formData.buying_price),
            selling_price: Number(formData.selling_price),
            quantity: Number(formData.quantity),
            low_stock_level: 7,
            image_url: formData.image_url,
            created_at: editingProduct?.created_at || now,
            updated_at: now,
            synced: false,
          };

          if (editingProduct) {
            await db.products.put(productRecord as any);
            await enqueueMutation('products', 'UPDATE', localId, { ...productRecord });
          } else {
            await db.products.add(productRecord as any);
            await enqueueMutation('products', 'INSERT', localId, { ...productRecord });
          }

          if (selectedFiles.length > 0) {
            for (const f of selectedFiles) {
              await storeLocalImage(localId, f);
            }
          }

          // refresh UI
          resetForm();
          setSelectedFiles([]);
          setPreviewUrls([]);
          fetchProducts();
          console.log('✅ Product saved offline, will sync when online');
        } catch (offlineError) {
          console.error('Error saving product offline:', offlineError);
        }
      } else {
        console.error('Error saving product:', error);
      }
    }
  };

  const handleRestock = async () => {
    if (!restockModal || !restockQuantity) return;

    try {
      const newQuantity = restockModal.quantity + Number(restockQuantity);

      // Update in LOCAL DB immediately
      await db.products.update(restockModal.id, {
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      });

      // Queue mutation to sync to Supabase
      await enqueueMutation('products', 'UPDATE', restockModal.id, {
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      });

      setRestockModal(null);
      setRestockQuantity('');
      fetchProducts();
    } catch (error) {
      console.error('Error restocking product:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;

    try {
      // Delete from LOCAL DB
      await db.products.delete(deleteModal.id);

      // Queue mutation to sync deletion to Supabase
      await enqueueMutation('products', 'DELETE', deleteModal.id, {});

      setDeleteModal(null);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      buying_price: '',
      selling_price: '',
      quantity: '',
      image_url: '',
    });
    setEditingProduct(null);
    setShowModal(false);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      buying_price: product.buying_price.toString(),
      selling_price: product.selling_price.toString(),
      quantity: product.quantity.toString(),
      image_url: product.image_url,
    });
    setShowModal(true);
  };

  const getStockStatus = (product: Product) => {
    if (product.quantity === 0) {
      return { label: 'Out of Stock', color: 'text-red-600', bgColor: 'bg-red-100' };
    }
    if (product.quantity <= product.low_stock_level) {
      return { label: 'Low Stock', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    }
    return { label: 'In Stock', color: 'text-green-600', bgColor: 'bg-green-100' };
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
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products & Stock</h1>
          <p className="text-gray-500 mt-1">Manage your inventory</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => {
          const status = getStockStatus(product);
          return (
            <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden relative">
                {imageMap[product.id] && imageMap[product.id].length > 0 ? (
                  <>
                    <img
                      src={
                        imageMap[product.id][imageIndexMap[product.id] || 0].remote_url ||
                        (imageMap[product.id][imageIndexMap[product.id] || 0].blob
                          ? URL.createObjectURL(imageMap[product.id][imageIndexMap[product.id] || 0].blob)
                          : imageMap[product.id][imageIndexMap[product.id] || 0].local_path)
                      }
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    {imageMap[product.id].length > 1 && (
                      <div className="absolute inset-0 flex items-center justify-between px-2">
                        <button
                          onClick={() => {
                            setImageIndexMap((m) => ({ ...m, [product.id]: Math.max((m[product.id] || 0) - 1, 0) }));
                          }}
                          className="bg-white bg-opacity-70 rounded-full p-1"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setImageIndexMap((m) => ({
                              ...m,
                              [product.id]: Math.min((m[product.id] || 0) + 1, imageMap[product.id].length - 1),
                            }));
                          }}
                          className="bg-white bg-opacity-70 rounded-full p-1"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                ) : product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-16 h-16 text-gray-300" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-500">{product.category}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Stock:</span> {product.quantity} units
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Price:</span> KSh {product.selling_price}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(product)}
                    className="flex-1 bg-purple-50 text-purple-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-100"
                  >
                    <Edit className="w-4 h-4 inline mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => setRestockModal(product)}
                    className="flex-1 bg-green-50 text-green-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-100"
                  >
                    <Package className="w-4 h-4 inline mr-1" />
                    Restock
                  </button>
                  <button
                    onClick={() => setDeleteModal(product)}
                    className="flex-1 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4 inline mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No products found</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Buying Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.buying_price}
                      onChange={(e) => setFormData({ ...formData, buying_price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Images</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      setSelectedFiles(files);
                      // create previews
                      const urls = files.map((f) => URL.createObjectURL(f));
                      setPreviewUrls(urls);
                    }}
                    className="w-full"
                  />

                  {/* previews of newly selected files */}
                  {previewUrls.length > 0 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto">
                      {previewUrls.map((u, i) => (
                        <img key={i} src={u} className="w-20 h-20 object-cover rounded" />
                      ))}
                    </div>
                  )}

                  {/* existing images for editing product */}
                  {editingProduct && imageMap[editingProduct.id] && imageMap[editingProduct.id].length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {imageMap[editingProduct.id].map((img: any) => (
                        <div key={img.id} className="relative">
                          <img
                            src={img.remote_url || (img.blob ? URL.createObjectURL(img.blob) : img.local_path)}
                            className="w-20 h-20 object-cover rounded"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              // delete local image metadata
                              await deleteLocalImage(img.id);
                              // refresh image map
                              const imgs = await getProductImages(editingProduct.id);
                              setImageMap((m) => ({ ...m, [editingProduct.id]: imgs }));
                            }}
                            className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700"
                  >
                    {editingProduct ? 'Update' : 'Add'} Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {restockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Restock Product</h2>
            <div className="mb-4">
              <p className="text-gray-600">
                <span className="font-medium">{restockModal.name}</span>
              </p>
              <p className="text-sm text-gray-500">Current stock: {restockModal.quantity} units</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Add Quantity</label>
              <input
                type="number"
                min="1"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Enter quantity to add"
              />
            </div>
            {restockQuantity && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">
                  New stock: {restockModal.quantity + Number(restockQuantity)} units
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRestockModal(null);
                  setRestockQuantity('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                disabled={!restockQuantity || Number(restockQuantity) <= 0}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Delete Product?</h2>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Are you sure you want to permanently delete <span className="font-semibold">{deleteModal.name}</span>?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
