export function cleanText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

export function extractPrice(priceText) {
  if (!priceText) return null;
  
  const cleaned = cleanText(priceText);
  const priceMatch = cleaned.match(/[\d,]+/);
  
  if (priceMatch) {
    return parseInt(priceMatch[0].replace(/,/g, ''));
  }
  
  return null;
}

export function validateListing(listing) {
  const requiredFields = ['title', 'price', 'location'];
  const missingFields = requiredFields.filter(field => !listing[field]);
  
  if (missingFields.length > 0) {
    console.warn(`⚠️ Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
    return false;
  }
  
  return true;
}

export function normalizeData(listings) {
  return listings
    .map(listing => ({
      ...listing,
      title: cleanText(listing.title),
      price: cleanText(listing.price),
      location: cleanText(listing.location),
      description: cleanText(listing.description || ''),
      price_numeric: extractPrice(listing.price),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))
    .filter(validateListing);
}

export function deduplicateListings(listings, key = 'link') {
  const seen = new Set();
  return listings.filter(listing => {
    const value = listing[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

export function groupByLocation(listings) {
  return listings.reduce((groups, listing) => {
    const location = listing.location || 'Неизвестно';
    if (!groups[location]) {
      groups[location] = [];
    }
    groups[location].push(listing);
    return groups;
  }, {});
}

export function sortByPrice(listings, ascending = true) {
  return [...listings].sort((a, b) => {
    const priceA = a.price_numeric || 0;
    const priceB = b.price_numeric || 0;
    return ascending ? priceA - priceB : priceB - priceA;
  });
}

export function filterByPriceRange(listings, minPrice, maxPrice) {
  return listings.filter(listing => {
    const price = listing.price_numeric;
    if (!price) return false;
    return price >= minPrice && price <= maxPrice;
  });
}

export function generateReport(listings) {
  const total = listings.length;
  const validListings = listings.filter(l => l.price_numeric);
  const avgPrice = validListings.length > 0 
    ? validListings.reduce((sum, l) => sum + l.price_numeric, 0) / validListings.length 
    : 0;
  
  const locations = groupByLocation(listings);
  const locationCounts = Object.keys(locations).map(location => ({
    location,
    count: locations[location].length
  }));

  return {
    total_listings: total,
    valid_listings: validListings.length,
    average_price: Math.round(avgPrice),
    locations: locationCounts,
    generated_at: new Date().toISOString()
  };
} 