/*
 * Seed inventory — shipped with the site.
 * Listings created or edited in admin.html are layered on top of these
 * (see js/data.js). To publish permanently, export from the admin and
 * paste the JSON here, or connect a backend adapter.
 */
(function () {
  // Nearby places (OpenStreetMap), snapshotted when the listing was saved.
  const LAUREL_NEARBY = [
    {"name":"Burger King","cat":"dining","type":"Fast food","lat":35.07423,"lng":-78.926878},
    {"name":"Krispy Kreme","cat":"dining","type":"Fast food","lat":35.07682,"lng":-78.933903},
    {"name":"Popeyes","cat":"dining","type":"Fast food","lat":35.077037,"lng":-78.934579},
    {"name":"Subway","cat":"dining","type":"Restaurant","lat":35.078839,"lng":-78.938375},
    {"name":"McDonald's","cat":"dining","type":"Fast food","lat":35.078576,"lng":-78.940757},
    {"name":"Thai Lanna","cat":"dining","type":"Restaurant","lat":35.06807,"lng":-78.902517},
    {"name":"Snack Attack","cat":"shopping","type":"Convenience store","lat":35.074461,"lng":-78.927988},
    {"name":"Circle K","cat":"shopping","type":"Convenience store","lat":35.074032,"lng":-78.928763},
    {"name":"Fayetteville Technical Community College Campus","cat":"schools","type":"College","lat":35.070416,"lng":-78.927181},
    {"name":"Terry Sanford High School","cat":"schools","type":"School","lat":35.064514,"lng":-78.915376},
    {"name":"Belvedere School","cat":"schools","type":"School","lat":35.071395,"lng":-78.904456},
    {"name":"Fayetteville Academy","cat":"schools","type":"School","lat":35.063334,"lng":-78.941242},
    {"name":"Vanstory Hills Elementary School","cat":"schools","type":"School","lat":35.056993,"lng":-78.927399},
    {"name":"Alma Easom Elementary School","cat":"schools","type":"School","lat":35.061098,"lng":-78.908323},
    {"name":"A B Wilkins High School","cat":"schools","type":"School","lat":35.08257,"lng":-78.951931},
    {"name":"Greenwood Park","cat":"parks","type":"Park","lat":35.081348,"lng":-78.921236},
    {"name":"Cornerstone Christian Academy Field","cat":"parks","type":"Park","lat":35.082547,"lng":-78.928945},
    {"name":"Honeycutt Park","cat":"parks","type":"Park","lat":35.068243,"lng":-78.921786},
    {"name":"Cumberland Heights Park","cat":"parks","type":"Park","lat":35.074522,"lng":-78.912629},
    {"name":"Mazarick Park","cat":"parks","type":"Park","lat":35.072664,"lng":-78.906693},
    {"name":"Mary McDonald Park","cat":"parks","type":"Park","lat":35.074806,"lng":-78.905289},
    {"name":"Mazarick Memorial Park","cat":"parks","type":"Park","lat":35.071038,"lng":-78.903166},
    {"name":"Woodrow Park","cat":"parks","type":"Park","lat":35.061655,"lng":-78.912847},
    {"name":"Golf Practice Range","cat":"parks","type":"Golf course","lat":35.080914,"lng":-78.949427},
    {"name":"Roy G. Turner Park","cat":"parks","type":"Park","lat":35.095084,"lng":-78.94408},
    {"name":"CVS Pharmacy","cat":"health","type":"Pharmacy","lat":35.075366,"lng":-78.929549},
    {"name":"Therapy Playground","cat":"health","type":"Clinic","lat":35.087661,"lng":-78.927022}
  ];

window.VERDANT_SEED = [
  {
    id: 'laurel-1010',
    title: 'The Laurel',
    address: '1010 Laurel St',
    lat: 35.0781567, lng: -78.9250404,
    city: 'Fayetteville', state: 'NC', zip: '',
    neighborhood: 'Fayetteville',
    type: 'rent', status: 'available',
    price: 1900, beds: 3, baths: 3, sqft: 1770,
    description: 'A three-bedroom, three-bath home with 1,770 square feet of living space in Fayetteville.\n\nContact Verdant Properties to confirm availability and schedule a private showing.',
    features: [], photos: [], video: null, tour: null, nearby: LAUREL_NEARBY,
    featured: true, published: true
  },
  {
    id: 'laurel-1012',
    title: 'The Laurel',
    address: '1012 Laurel St',
    lat: 35.0781682, lng: -78.9250327,
    city: 'Fayetteville', state: 'NC', zip: '',
    neighborhood: 'Fayetteville',
    type: 'rent', status: 'available',
    price: 2000, beds: 3, baths: 3, sqft: 1770,
    description: 'A three-bedroom, three-bath home with 1,770 square feet of living space in Fayetteville.\n\nContact Verdant Properties to confirm availability and schedule a private showing.',
    features: [], photos: [], video: null, tour: null, nearby: LAUREL_NEARBY,
    featured: true, published: true
  },
  {
    id: 'laurel-1014',
    title: 'The Laurel',
    address: '1014 Laurel St',
    lat: 35.0781797, lng: -78.925025,
    city: 'Fayetteville', state: 'NC', zip: '',
    neighborhood: 'Fayetteville',
    type: 'rent', status: 'available',
    price: 1900, beds: 3, baths: 3, sqft: 1770,
    description: 'A three-bedroom, three-bath home with 1,770 square feet of living space in Fayetteville.\n\nContact Verdant Properties to confirm availability and schedule a private showing.',
    features: [], photos: [], video: null, tour: null, nearby: LAUREL_NEARBY,
    featured: true, published: true
  },
  {
    id: 'laurel-1016',
    title: 'The Laurel',
    address: '1016 Laurel St',
    lat: 35.0781912, lng: -78.9250173,
    city: 'Fayetteville', state: 'NC', zip: '',
    neighborhood: 'Fayetteville',
    type: 'rent', status: 'available',
    price: 1900, beds: 3, baths: 3, sqft: 1770,
    description: 'A three-bedroom, three-bath home with 1,770 square feet of living space in Fayetteville.\n\nContact Verdant Properties to confirm availability and schedule a private showing.',
    features: [], photos: [], video: null, tour: null, nearby: LAUREL_NEARBY,
    featured: true, published: true
  }
];
})();
