// API Communication Module - Supabase Edition
// This module provides a clean interface for all database and auth operations
// using Supabase client library with Row Level Security

const API = {
    // Helper to get current user session
    async getCurrentSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    // Helper to get current user with profile data
    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return null;

        // Fetch profile data to get role and other info
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return user; // Return auth user if profile fetch fails
        }

        return {
            ...user,
            ...profile
        };
    },

    // Authentication Methods
    auth: {
        // Register new user
        async register(userData) {
            const { email, password, firstName, lastName, phone, role } = userData;

            // 1. Sign up with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        phone: phone,
                        role: role || 'buyer'
                    }
                }
            });

            if (authError) throw new Error(authError.message);

            // 2. Profile is automatically created by database trigger
            // The trigger uses auth.uid() to create a profile entry

            return {
                user: authData.user,
                message: 'Registration successful! Please check your email to verify your account.'
            };
        },

        // Login
        async login(email, password) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw new Error(error.message);

            // Fetch full profile data
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError) throw new Error(profileError.message);

            return {
                user: data.user,
                profile: profile,
                session: data.session
            };
        },

        // Logout
        async logout() {
            const { error } = await supabase.auth.signOut();
            if (error) throw new Error(error.message);
            return { message: 'Logged out successfully' };
        },

        // Get current user with profile
        async getCurrentUser() {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return null;

            // Fetch profile data
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw new Error(error.message);

            return {
                ...user,
                ...profile
            };
        },

        // Update user profile
        async updateProfile(updates) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        }
    },

    // Pet Management
    pets: {
        // Get all pets with optional filters
        async getAll(filters = {}) {
            let query = supabase
                .from('pets')
                .select(`
                    *,
                    seller:profiles!pets_seller_id_fkey(id, first_name, last_name, email),
                    photos:pet_photos(id, photo_url, is_primary)
                `)
                .eq('status', 'available');

            // Apply sorting first (before other filters)
            if (filters.sort) {
                switch(filters.sort) {
                    case 'price_asc':
                        query = query.order('price', { ascending: true });
                        break;
                    case 'price_desc':
                        query = query.order('price', { ascending: false });
                        break;
                    case 'closest':
                        // For now, sort by location alphabetically
                        // In production, this would use geolocation distance
                        query = query.order('location', { ascending: true });
                        break;
                    case 'newest':
                    default:
                        query = query.order('created_at', { ascending: false });
                        break;
                }
            } else {
                query = query.order('created_at', { ascending: false });
            }

            // Apply type filter
            if (filters.type && filters.type.length > 0) {
                // Convert "puppies" to "dog" and "kittens" to "cat"
                const petTypes = filters.type.map(t => {
                    if (t === 'puppies') return 'dog';
                    if (t === 'kittens') return 'cat';
                    return t;
                });
                query = query.in('type', petTypes);
            }

            // Apply price filters
            if (filters.minPrice) {
                query = query.gte('price', parseFloat(filters.minPrice));
            }
            if (filters.maxPrice) {
                query = query.lte('price', parseFloat(filters.maxPrice));
            }

            // Apply age filters - handle age ranges like "0-8", "8-12", "3plus"
            if (filters.age && filters.age.length > 0) {
                // Convert week ranges to month filters
                let ageConditions = [];
                for (const ageRange of filters.age) {
                    if (ageRange === '0-8') {
                        // 0-8 weeks = 0-2 months
                        ageConditions.push('age_months.lte.2');
                    } else if (ageRange === '8-12') {
                        // 8-12 weeks = 2-3 months
                        ageConditions.push('and(age_months.gte.2,age_months.lte.3)');
                    } else if (ageRange === '3plus') {
                        // 3+ months
                        ageConditions.push('age_months.gte.3');
                    }
                }

                if (ageConditions.length > 0) {
                    // Use OR logic for multiple age ranges
                    query = query.or(ageConditions.join(','));
                }
            }

            if (filters.location) {
                query = query.ilike('location', `%${filters.location}%`);
            }
            if (filters.search) {
                query = query.or(`name.ilike.%${filters.search}%,breed.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
            }

            // Pagination
            const limit = parseInt(filters.limit) || 20;
            const offset = parseInt(filters.offset) || 0;
            query = query.range(offset, offset + limit - 1);

            const { data, error } = await query;

            if (error) throw new Error(error.message);

            // Add primary_photo field for convenience
            return data.map(pet => {
                const primaryPhoto = pet.photos?.find(p => p.is_primary) || pet.photos?.[0];
                return {
                    ...pet,
                    primary_photo: primaryPhoto?.photo_url || null
                };
            });
        },

        // Get pet by ID
        async getById(id) {
            const { data, error } = await supabase
                .from('pets')
                .select(`
                    *,
                    seller:profiles!pets_seller_id_fkey(id, first_name, last_name, email, phone, created_at),
                    photos:pet_photos(id, photo_url, is_primary)
                `)
                .eq('id', id)
                .single();

            if (error) throw new Error(error.message);

            // Add primary_photo and seller_name for convenience
            const primaryPhoto = data.photos?.find(p => p.is_primary) || data.photos?.[0];
            return {
                ...data,
                primary_photo: primaryPhoto?.photo_url || null,
                seller_name: data.seller ? `${data.seller.first_name} ${data.seller.last_name}` : 'Unknown',
                seller_created_at: data.seller?.created_at
            };
        },

        // Create new pet listing (sellers only)
        async create(formData) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');
            if (user.role !== 'seller') throw new Error('Only sellers can create listings');

            // Extract pet data from FormData
            const petData = {
                seller_id: user.id,
                name: formData.get('name'),
                type: formData.get('type'),
                breed: formData.get('breed'),
                age_months: parseInt(formData.get('age_months')),
                price: parseFloat(formData.get('price')),
                description: formData.get('description'),
                location: formData.get('location'),
                gender: formData.get('gender'),
                vaccinated: formData.get('vaccinated') === 'true',
                neutered: formData.get('neutered') === 'true',
                quantity: parseInt(formData.get('quantity')) || 1,
                status: 'available'
            };

            // Create pet record
            const { data: pet, error: petError } = await supabase
                .from('pets')
                .insert([petData])
                .select()
                .single();

            if (petError) throw new Error(petError.message);

            // Upload photos if provided
            const photos = formData.getAll('photos');
            if (photos && photos.length > 0) {
                const photoUrls = [];

                for (let i = 0; i < photos.length; i++) {
                    const photo = photos[i];
                    if (!photo || photo.size === 0) continue;

                    const fileExt = photo.name.split('.').pop();
                    const fileName = `${user.id}/${pet.id}/${Date.now()}_${i}.${fileExt}`;

                    // Upload to Supabase Storage
                    const { error: uploadError } = await supabase.storage
                        .from('pet-photos')
                        .upload(fileName, photo, {
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (uploadError) {
                        console.error('Photo upload error:', uploadError);
                        continue;
                    }

                    // Get public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('pet-photos')
                        .getPublicUrl(fileName);

                    photoUrls.push({
                        pet_id: pet.id,
                        photo_url: publicUrl,
                        storage_path: fileName,
                        is_primary: i === 0
                    });
                }

                // Insert photo records
                if (photoUrls.length > 0) {
                    const { error: photoError } = await supabase
                        .from('pet_photos')
                        .insert(photoUrls);

                    if (photoError) {
                        console.error('Photo record error:', photoError);
                    }
                }
            }

            return pet;
        },

        // Update pet listing
        async update(id, updates) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            // RLS policy will ensure only the owner can update
            const { data, error } = await supabase
                .from('pets')
                .update(updates)
                .eq('id', id)
                .eq('seller_id', user.id)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },

        // Delete pet listing
        async delete(id) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            // RLS policy will ensure only the owner can delete
            const { error } = await supabase
                .from('pets')
                .delete()
                .eq('id', id)
                .eq('seller_id', user.id);

            if (error) throw new Error(error.message);
            return { message: 'Pet deleted successfully' };
        },

        // Get my listings (for sellers)
        async getMyListings() {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('pets')
                .select(`
                    *,
                    photos:pet_photos(id, photo_url, is_primary)
                `)
                .eq('seller_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);
            return data;
        }
    },

    // Shopping Cart
    cart: {
        // Get cart items
        async get() {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('cart')
                .select(`
                    *,
                    pet:pets(
                        *,
                        seller:profiles!pets_seller_id_fkey(id, first_name, last_name),
                        photos:pet_photos(id, photo_url, is_primary)
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);

            // Transform data for cart display
            const items = data.map(cartItem => {
                const pet = cartItem.pet;
                const photos = pet.photos || [];
                const primaryPhoto = photos.find(p => p.is_primary) || photos[0];

                return {
                    id: cartItem.id,
                    pet_id: pet.id,
                    quantity: cartItem.quantity,
                    price: parseFloat(pet.price),
                    name: pet.name,
                    type: pet.type,
                    breed: pet.breed,
                    seller_name: `${pet.seller.first_name} ${pet.seller.last_name}`,
                    seller_id: pet.seller_id,
                    primary_photo: primaryPhoto?.photo_url || null,
                    available_quantity: pet.quantity,
                    status: pet.status
                };
            });

            // Calculate summary
            const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const buyerFee = subtotal * 0.05; // 5% buyer fee
            const total = subtotal + buyerFee;

            return {
                items,
                summary: {
                    subtotal,
                    buyerFee,
                    total
                }
            };
        },

        // Add item to cart
        async add(petId, quantity = 1) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            // Check if item already in cart
            const { data: existing } = await supabase
                .from('cart')
                .select('id, quantity')
                .eq('user_id', user.id)
                .eq('pet_id', petId)
                .single();

            if (existing) {
                // Update quantity
                return await API.cart.update(existing.id, existing.quantity + quantity);
            }

            // Add new item
            const { data, error } = await supabase
                .from('cart')
                .insert([{
                    user_id: user.id,
                    pet_id: petId,
                    quantity: quantity
                }])
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },

        // Update cart item quantity
        async update(cartItemId, quantity) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('cart')
                .update({ quantity })
                .eq('id', cartItemId)
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },

        // Remove item from cart
        async remove(cartItemId) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('cart')
                .delete()
                .eq('id', cartItemId)
                .eq('user_id', user.id);

            if (error) throw new Error(error.message);
            return { message: 'Item removed from cart' };
        },

        // Clear entire cart
        async clear() {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('cart')
                .delete()
                .eq('user_id', user.id);

            if (error) throw new Error(error.message);
            return { message: 'Cart cleared' };
        }
    },

    // Orders
    orders: {
        // Create orders from cart (checkout)
        async checkout(checkoutData) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            // Get cart items with pet details
            const cartData = await API.cart.get();
            if (!cartData || !cartData.items || cartData.items.length === 0) {
                throw new Error('Cart is empty');
            }

            // Format shipping address
            const shippingAddress = checkoutData.address ?
                `${checkoutData.address.street}, ${checkoutData.address.city}, ${checkoutData.address.state} ${checkoutData.address.zipCode}` :
                checkoutData.shippingAddress || '';

            // Create orders for each cart item
            const orders = [];
            for (const item of cartData.items) {
                const quantity = item.quantity;
                const petPrice = parseFloat(item.price);

                // Calculate fees
                const buyerFee = petPrice * quantity * 0.05; // 5%
                const sellerFee = petPrice * quantity * 0.10; // 10%
                const totalAmount = (petPrice * quantity) + buyerFee;
                const sellerPayout = (petPrice * quantity) - sellerFee;

                const orderData = {
                    buyer_id: user.id,
                    seller_id: item.seller_id,
                    pet_id: item.pet_id,
                    quantity: quantity,
                    pet_price: petPrice,
                    buyer_fee: buyerFee,
                    seller_fee: sellerFee,
                    total_amount: totalAmount,
                    seller_payout: sellerPayout,
                    status: 'pending',
                    shipping_address: shippingAddress,
                    phone: checkoutData.phone,
                    notes: checkoutData.notes || null
                };

                const { data: order, error } = await supabase
                    .from('orders')
                    .insert([orderData])
                    .select()
                    .single();

                if (error) throw new Error(error.message);
                orders.push(order);
            }

            // Clear cart after creating orders
            await API.cart.clear();

            // Return orders with orderIds for payment processing
            return {
                orders,
                orderIds: orders.map(o => o.id)
            };
        },

        // Create Stripe payment intent
        async createPaymentIntent(orderIds) {
            const session = await API.getCurrentSession();
            if (!session) throw new Error('Not authenticated');

            // Call the Stripe payment server
            const response = await fetch('http://localhost:3001/api/stripe/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ orderIds })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || data.error || 'Failed to create payment intent');
            }

            return data;
        },

        // Confirm payment (called after Stripe confirms)
        async confirmPayment(orderIds, paymentIntentId) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            // Update order status to paid
            const { data, error } = await supabase
                .from('orders')
                .update({
                    status: 'paid',
                    stripe_payment_id: paymentIntentId
                })
                .in('id', orderIds)
                .eq('buyer_id', user.id)
                .select();

            if (error) throw new Error(error.message);
            return data;
        },

        // Get my purchases (buyer)
        async getMyPurchases() {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    pet:pets(
                        *,
                        photos:pet_photos(id, photo_url, is_primary)
                    ),
                    seller:profiles!orders_seller_id_fkey(id, first_name, last_name, email)
                `)
                .eq('buyer_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);
            return data;
        },

        // Get my sales (seller)
        async getMySales() {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    pet:pets(
                        *,
                        photos:pet_photos(id, photo_url, is_primary)
                    ),
                    buyer:profiles!orders_buyer_id_fkey(id, first_name, last_name, email)
                `)
                .eq('seller_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);
            return data;
        },

        // Get order by ID
        async getById(id) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    pet:pets(
                        *,
                        photos:pet_photos(id, photo_url, is_primary)
                    ),
                    buyer:profiles!orders_buyer_id_fkey(id, first_name, last_name, email),
                    seller:profiles!orders_seller_id_fkey(id, first_name, last_name, email)
                `)
                .eq('id', id)
                .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
                .single();

            if (error) throw new Error(error.message);
            return data;
        },

        // Update order status (seller only)
        async updateStatus(id, status) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('orders')
                .update({ status })
                .eq('id', id)
                .eq('seller_id', user.id)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        }
    },

    // Messages
    messages: {
        // Get inbox
        async getInbox() {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    sender:profiles!messages_sender_id_fkey(id, first_name, last_name),
                    pet:pets(id, name)
                `)
                .eq('recipient_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);
            return data;
        },

        // Get sent messages
        async getSent() {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    recipient:profiles!messages_recipient_id_fkey(id, first_name, last_name),
                    pet:pets(id, name)
                `)
                .eq('sender_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);
            return data;
        },

        // Get conversation with a user
        async getConversation(userId) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    sender:profiles!messages_sender_id_fkey(id, first_name, last_name),
                    recipient:profiles!messages_recipient_id_fkey(id, first_name, last_name),
                    pet:pets(id, name)
                `)
                .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
                .order('created_at', { ascending: true });

            if (error) throw new Error(error.message);
            return data;
        },

        // Send message
        async send(messageData) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('messages')
                .insert([{
                    sender_id: user.id,
                    recipient_id: messageData.recipientId,
                    pet_id: messageData.petId || null,
                    subject: messageData.subject,
                    message: messageData.message,
                    is_read: false
                }])
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },

        // Mark message as read
        async markAsRead(messageId) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('id', messageId)
                .eq('recipient_id', user.id)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },

        // Delete message
        async delete(messageId) {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', messageId)
                .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`);

            if (error) throw new Error(error.message);
            return { message: 'Message deleted' };
        },

        // Get unread count
        async getUnreadCount() {
            const user = await API.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('recipient_id', user.id)
                .eq('is_read', false);

            if (error) throw new Error(error.message);
            return count;
        }
    },

    // Admin Operations
    admin: {
        // Get dashboard stats
        async getStats() {
            const user = await API.getCurrentUser();
            if (!user || user.role !== 'admin') {
                throw new Error('Admin access required');
            }

            // Get counts for various entities
            const [usersCount, petsCount, ordersCount, revenue] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('pets').select('*', { count: 'exact', head: true }),
                supabase.from('orders').select('*', { count: 'exact', head: true }),
                supabase.from('orders').select('total_amount').eq('status', 'paid')
            ]);

            const totalRevenue = revenue.data?.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

            return {
                totalUsers: usersCount.count || 0,
                totalPets: petsCount.count || 0,
                totalOrders: ordersCount.count || 0,
                totalRevenue: totalRevenue
            };
        },

        // Get all users
        async getUsers() {
            const user = await API.getCurrentUser();
            if (!user || user.role !== 'admin') {
                throw new Error('Admin access required');
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);
            return data;
        },

        // Get all pets
        async getPets() {
            const user = await API.getCurrentUser();
            if (!user || user.role !== 'admin') {
                throw new Error('Admin access required');
            }

            const { data, error } = await supabase
                .from('pets')
                .select(`
                    *,
                    seller:profiles!pets_seller_id_fkey(id, first_name, last_name, email),
                    photos:pet_photos(id, photo_url, is_primary)
                `)
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);
            return data;
        },

        // Get all orders
        async getOrders() {
            const user = await API.getCurrentUser();
            if (!user || user.role !== 'admin') {
                throw new Error('Admin access required');
            }

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    pet:pets(id, name),
                    buyer:profiles!orders_buyer_id_fkey(id, first_name, last_name, email),
                    seller:profiles!orders_seller_id_fkey(id, first_name, last_name, email)
                `)
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);
            return data;
        },

        // Update user role
        async updateUserRole(userId, role) {
            const user = await API.getCurrentUser();
            if (!user || user.role !== 'admin') {
                throw new Error('Admin access required');
            }

            const { data, error } = await supabase
                .from('profiles')
                .update({ role })
                .eq('id', userId)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },

        // Delete user
        async deleteUser(userId) {
            const user = await API.getCurrentUser();
            if (!user || user.role !== 'admin') {
                throw new Error('Admin access required');
            }

            // Note: This will cascade delete related records based on DB constraints
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) throw new Error(error.message);
            return { message: 'User deleted successfully' };
        },

        // Update pet status
        async updatePetStatus(petId, status) {
            const user = await API.getCurrentUser();
            if (!user || user.role !== 'admin') {
                throw new Error('Admin access required');
            }

            const { data, error } = await supabase
                .from('pets')
                .update({ status })
                .eq('id', petId)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },

        // Delete pet
        async deletePet(petId) {
            const user = await API.getCurrentUser();
            if (!user || user.role !== 'admin') {
                throw new Error('Admin access required');
            }

            const { error } = await supabase
                .from('pets')
                .delete()
                .eq('id', petId);

            if (error) throw new Error(error.message);
            return { message: 'Pet deleted successfully' };
        },

        // Update order status (admin can update any order)
        async updateOrderStatus(orderId, status) {
            const user = await API.getCurrentUser();
            if (!user || user.role !== 'admin') {
                throw new Error('Admin access required');
            }

            const { data, error } = await supabase
                .from('orders')
                .update({ status })
                .eq('id', orderId)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
