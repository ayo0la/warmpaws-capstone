import { supabase } from '../config/supabase.js';

export const getUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, created_at')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
    }

    res.json({
      success: true,
      data: { user: data },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch user' },
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Users can only update their own profile
    if (req.user.id !== id) {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized to update this user' },
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }

    res.json({
      success: true,
      data: { user: data },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update user' },
    });
  }
};

export const getUserPets = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('owner_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }

    res.json({
      success: true,
      data: { pets: data },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch user pets' },
    });
  }
};
