import type { Subcategory } from '@lboa/types';

export const subcategories: Subcategory[] = [
  // food-drink
  {
    id: 'cafes-bakeries',
    categoryId: 'food-drink',
    name: 'Cafes & Bakeries',
    description: 'Coffee, tea, baked goods, and sweet-snack concepts.',
  },
  {
    id: 'restaurants',
    categoryId: 'food-drink',
    name: 'Restaurants',
    description: 'Sit-down dining across cuisines and price points.',
  },
  {
    id: 'quick-service',
    categoryId: 'food-drink',
    name: 'Quick Service',
    description: 'Fast, counter-service food concepts.',
  },
  {
    id: 'bars-nightlife',
    categoryId: 'food-drink',
    name: 'Bars & Nightlife',
    description: 'Evening-oriented drinking and social venues.',
  },
  {
    id: 'specialty-food',
    categoryId: 'food-drink',
    name: 'Specialty Food Shops',
    description: 'Retail of curated food and drink products.',
  },
  // retail
  {
    id: 'grocery-convenience',
    categoryId: 'retail',
    name: 'Grocery & Convenience',
    description: 'Everyday food and household staples retail.',
  },
  {
    id: 'fashion-apparel',
    categoryId: 'retail',
    name: 'Fashion & Apparel',
    description: 'Clothing, footwear, and personal accessories.',
  },
  {
    id: 'electronics-media',
    categoryId: 'retail',
    name: 'Electronics & Media',
    description: 'Consumer electronics, books, games, and media goods.',
  },
  {
    id: 'home-goods',
    categoryId: 'retail',
    name: 'Home Goods',
    description: 'Furniture, decor, and household equipment.',
  },
  {
    id: 'specialty-retail',
    categoryId: 'retail',
    name: 'Specialty Retail',
    description: 'Niche and gift-oriented product shops.',
  },
  {
    id: 'outdoor-garden',
    categoryId: 'retail',
    name: 'Outdoor & Garden',
    description: 'Garden, bicycle, and outdoor-equipment retail.',
  },
  // health-wellness
  {
    id: 'medical-clinics',
    categoryId: 'health-wellness',
    name: 'Medical Clinics',
    description: 'Doctor-led outpatient care practices.',
  },
  {
    id: 'pharmacies-optics',
    categoryId: 'health-wellness',
    name: 'Pharmacies & Optics',
    description: 'Medication, optical, and medical-supply retail.',
  },
  {
    id: 'therapy-rehab',
    categoryId: 'health-wellness',
    name: 'Therapy & Rehabilitation',
    description: 'Physical and mental therapy practices.',
  },
  {
    id: 'wellness-spa',
    categoryId: 'health-wellness',
    name: 'Wellness & Spa',
    description: 'Relaxation and body-wellness services.',
  },
  // personal-services
  {
    id: 'hair-beauty',
    categoryId: 'personal-services',
    name: 'Hair & Beauty',
    description: 'Hair, nails, skin, and body-art services.',
  },
  {
    id: 'cleaning-laundry',
    categoryId: 'personal-services',
    name: 'Cleaning & Laundry',
    description: 'Garment cleaning and laundry services.',
  },
  {
    id: 'repair-alterations',
    categoryId: 'personal-services',
    name: 'Repair & Alterations',
    description: 'Repair and tailoring of personal items.',
  },
  {
    id: 'everyday-services',
    categoryId: 'personal-services',
    name: 'Everyday Services',
    description: 'Miscellaneous walk-in consumer services.',
  },
  // education
  {
    id: 'childcare-early',
    categoryId: 'education',
    name: 'Childcare & Early Years',
    description: 'Care and early education for young children.',
  },
  {
    id: 'tutoring-training',
    categoryId: 'education',
    name: 'Tutoring & Training',
    description: 'Academic and professional skill instruction.',
  },
  {
    id: 'arts-skills',
    categoryId: 'education',
    name: 'Arts & Skills',
    description: 'Creative and practical skills schools.',
  },
  // entertainment-leisure
  {
    id: 'venues-events',
    categoryId: 'entertainment-leisure',
    name: 'Venues & Events',
    description: 'Stage, screen, and night-out venues.',
  },
  {
    id: 'games-recreation',
    categoryId: 'entertainment-leisure',
    name: 'Games & Recreation',
    description: 'Active and game-based recreation concepts.',
  },
  {
    id: 'culture-media',
    categoryId: 'entertainment-leisure',
    name: 'Culture & Media',
    description: 'Galleries, museums, and cultural attractions.',
  },
  // automotive
  {
    id: 'vehicle-sales',
    categoryId: 'automotive',
    name: 'Vehicle Sales & Rental',
    description: 'Sale and rental of cars and motorcycles.',
  },
  {
    id: 'vehicle-service',
    categoryId: 'automotive',
    name: 'Vehicle Service',
    description: 'Repair, parts, and care of vehicles.',
  },
  {
    id: 'fuel-wash',
    categoryId: 'automotive',
    name: 'Fuel & Wash',
    description: 'Fueling, charging, and washing services.',
  },
  // hospitality
  {
    id: 'lodging',
    categoryId: 'hospitality',
    name: 'Lodging',
    description: 'Overnight accommodation businesses.',
  },
  {
    id: 'event-hospitality',
    categoryId: 'hospitality',
    name: 'Event Hospitality',
    description: 'Venues for hosted events and conferences.',
  },
  // professional-services
  {
    id: 'finance-legal',
    categoryId: 'professional-services',
    name: 'Finance & Legal',
    description: 'Financial, legal, and fiduciary offices.',
  },
  {
    id: 'agencies-consulting',
    categoryId: 'professional-services',
    name: 'Agencies & Consulting',
    description: 'Client-serving agencies and consultancies.',
  },
  {
    id: 'workspaces',
    categoryId: 'professional-services',
    name: 'Workspaces',
    description: 'Shared and serviced office space.',
  },
  // home-construction
  {
    id: 'building-materials',
    categoryId: 'home-construction',
    name: 'Building Materials',
    description: 'Materials and tools for building and renovation.',
  },
  {
    id: 'trades-crafts',
    categoryId: 'home-construction',
    name: 'Trades & Crafts',
    description: 'Skilled trade contractors with local premises.',
  },
  {
    id: 'home-showrooms',
    categoryId: 'home-construction',
    name: 'Home Showrooms',
    description: 'Showroom-based kitchen and bathroom retail.',
  },
  // pets
  {
    id: 'pet-supplies',
    categoryId: 'pets',
    name: 'Pet Supplies',
    description: 'Retail of pet food, animals, and accessories.',
  },
  {
    id: 'pet-care',
    categoryId: 'pets',
    name: 'Pet Care',
    description: 'Veterinary, grooming, and boarding services.',
  },
  // fitness-sports
  {
    id: 'gyms-studios',
    categoryId: 'fitness-sports',
    name: 'Gyms & Studios',
    description: 'Membership gyms and class-based studios.',
  },
  {
    id: 'sports-facilities',
    categoryId: 'fitness-sports',
    name: 'Sports Facilities',
    description: 'Court, pool, and climbing facilities.',
  },
  {
    id: 'sports-retail',
    categoryId: 'fitness-sports',
    name: 'Sports Retail',
    description: 'Sporting goods and athletic footwear retail.',
  },
];
