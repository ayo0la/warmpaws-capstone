-- Sample seed data for testing (optional)
-- Note: This requires manual user creation through Supabase Auth first

-- Sample pets data (replace owner_id with actual user IDs from your Supabase Auth)
INSERT INTO public.pets (name, species, breed, age_years, age_months, gender, size, color, description, health_status, vaccination_status, spayed_neutered, good_with_kids, good_with_dogs, good_with_cats, energy_level, status, adoption_fee, location_city, location_state)
VALUES
  ('Max', 'dog', 'Golden Retriever', 3, 0, 'male', 'large', 'Golden', 'Friendly and energetic golden retriever looking for an active family. Loves to play fetch and go on long walks.', 'Healthy', 'Up to date', true, true, true, true, 'high', 'available', 250.00, 'San Francisco', 'CA'),
  ('Luna', 'cat', 'Siamese', 2, 6, 'female', 'small', 'Cream and brown', 'Elegant Siamese cat with beautiful blue eyes. Very vocal and loves attention.', 'Healthy', 'Up to date', true, true, false, true, 'medium', 'available', 150.00, 'Los Angeles', 'CA'),
  ('Charlie', 'dog', 'Labrador Retriever', 1, 8, 'male', 'large', 'Yellow', 'Playful young lab full of energy. Great with kids and other dogs. Needs an active home.', 'Healthy', 'Up to date', false, true, true, true, 'high', 'available', 300.00, 'San Diego', 'CA'),
  ('Bella', 'cat', 'Domestic Shorthair', 4, 0, 'female', 'medium', 'Black and white', 'Sweet and affectionate cat who loves to cuddle. Perfect lap cat for a quiet home.', 'Healthy', 'Up to date', true, true, false, true, 'low', 'available', 100.00, 'San Francisco', 'CA'),
  ('Rocky', 'dog', 'German Shepherd', 5, 0, 'male', 'large', 'Black and tan', 'Loyal and protective German Shepherd. Well-trained and obedient. Best as only pet.', 'Healthy', 'Up to date', true, true, false, false, 'medium', 'available', 200.00, 'Sacramento', 'CA'),
  ('Whiskers', 'cat', 'Persian', 3, 0, 'male', 'medium', 'White', 'Gorgeous Persian cat with long fluffy coat. Requires regular grooming. Very gentle.', 'Healthy', 'Up to date', true, true, false, true, 'low', 'available', 175.00, 'San Jose', 'CA'),
  ('Daisy', 'dog', 'Beagle', 2, 0, 'female', 'medium', 'Tri-color', 'Curious and friendly beagle. Loves to follow her nose! Good with families and other pets.', 'Healthy', 'Up to date', true, true, true, true, 'medium', 'available', 225.00, 'Oakland', 'CA'),
  ('Mittens', 'cat', 'Maine Coon', 1, 6, 'female', 'large', 'Gray tabby', 'Gentle giant Maine Coon kitten. Very social and loves to play. Great with everyone.', 'Healthy', 'Up to date', true, true, true, true, 'medium', 'available', 200.00, 'Berkeley', 'CA');

-- Note: To use this seed data:
-- 1. Create a user account through Supabase Auth
-- 2. Update the owner_id in the INSERT statement above with your user ID
-- 3. Run this SQL in your Supabase SQL Editor
