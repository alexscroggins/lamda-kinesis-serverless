const algoliasearch = require('algoliasearch');
const algoliaClient = algoliasearch('TODO', 'TODO');
const algoliaIndex = algoliaClient.initIndex('university-project');
const _ = require('lodash');

algoliaIndex.setSettings({
  searchableAttributes: [
    'objectID'
  ],
  attributesForFaceting: [
    'menu.graduate',
    'menu.undergraduate',
    'filterOnly(course.name)',
    'filterOnly(course.level)',
    'filterOnly(course.minimumGreScore)'
  ]
});

module.exports.addToAlgolia = data => {
  return algoliaIndex.addObject(data);
}

module.exports.getMenu = category => {
  const facet = (category === 'graduate' ? 'menu.graduate' : 'menu.undergraduate');

  return algoliaIndex.search('', {
    facets: facet
  })
  .then(content => {
    console.log(content);
    const facetResults = content.facets[facet];
    const keys = _.keys(facetResults);
    return keys;
  });

  ;
};

module.exports.getById = id => {
  return algoliaIndex.search(id)
    .then(content => {
      return content.hits[0];
    });
};

module.exports.searchByFilters = queryParams => {
  const name = queryParams.name;
  const level = queryParams.level;

  let filter = `course.name: '${name}' AND course.level: '${level}'`;

  const gre = queryParams.gre;
  if (gre) {
    filter += ` AND course.minimumGreScore < ${gre}`;
  }

  console.log(filter);

  return algoliaIndex.search({
    hitsPerPage: 100,
    filters: filter
  })
    .then(results => {
      return results.hits;
    });
};
