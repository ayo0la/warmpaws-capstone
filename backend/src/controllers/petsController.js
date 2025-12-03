import { supabase } from '../config/supabase.js';

export const getAllPets = async (req, res) => {
  try {
    const {
      species,
      breed,
      age_min,
      age_max,
      status = 'available',
      limit = 50,
      offset = 0
    } = req.query;

    let query = supabase
      .from('pets')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (species) {
      query = query.eq('species', species);
    }

    if (breed) {
      query = query.ilike('breed', `%${breed}%`);
    }

    if (age_min) {
      query = query.gte('age_years', age_min);
    }

    if (age_max) {
      query = query.lte('age_years', age_max);
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }

    res.json({
      success: true,
      data: {
        pets: data,
        pagination: {
          total: count,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch pets' },
    });
  }
};

export const getPetById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: { message: 'Pet not found' },
      });
    }

    res.json({
      success: true,
      data: { pet: data },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch pet' },
    });
  }
};

export const createPet = async (req, res) => {
  try {
    const petData = req.body;
    petData.owner_id = req.user.id;

    const { data, error } = await supabase
      .from('pets')
      .insert([petData])
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }

    res.status(201).json({
      success: true,
      data: { pet: data },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create pet listing' },
    });
  }
};

export const updatePet = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const { data: pet } = await supabase
      .from('pets')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!pet || pet.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized to update this pet' },
      });
    }

    const { data, error } = await supabase
      .from('pets')
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
      data: { pet: data },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update pet' },
    });
  }
};

export const deletePet = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const { data: pet } = await supabase
      .from('pets')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!pet || pet.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized to delete this pet' },
      });
    }

    const { error } = await supabase
      .from('pets')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    }

    res.json({
      success: true,
      message: 'Pet deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete pet' },
    });
  }
};
