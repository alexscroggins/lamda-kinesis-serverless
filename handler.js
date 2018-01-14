const _ = require('lodash');
const AWS = require('aws-sdk');
const kinesisClient = new AWS.Kinesis({
  'region': 'us-east-1'
});
const eachOf = require('async/eachOf');
const helper = require('./helper');

const attachPartitionKey = record => {
  return {
    'PartitionKey': record.course.level,
    'Data': JSON.stringify(record) // New Buffer() of a string
  };
};

const generatedId = (zip, courseLevel, courseName) => {
  const newCourseName = courseName.replace(/\s/g, '');
  const id = `${zip}-${courseLevel}-${newCourseName}`;
  return id;
};

const prepareRecord = record => {
  record.objectID = generatedId(record.address.zip, record.course.level, record.course.name);

  record.menu = {};

  if (record.course.level === 'graduate') {
    record.menu['graduate'] = record.course.name;
  } else if (record.course.level === 'undergraduate') {
    record.menu['undergraduate'] = record.course.name;
  }
};

module.exports.pushToKinesis2 = (event, context, callback) => {

  const universityList = require('./university-data.json');

  const records = [];

  _.forEach(universityList, university => {
    let metaInfo = _.omit(university, ['courses']);

    _.forEach(university.courses, course => {
      let record = JSON.parse(JSON.stringify(metaInfo)); // Creating a copy of this object.
      record.course = course;
      prepareRecord(record);
      records.push(record);
    });

  });

  const recordsToTransmit = _.map(records, attachPartitionKey);

  const params = {
    Records: recordsToTransmit,
    StreamName: 'university-project-stream'
  };

  kinesisClient.putRecords(params, (err, data) => {
    if (err) {
      console.log(err, err.stack);
      callback(err, null);
    }
    else {
      console.log(data);
      callback(null, data);
    }
  });

};

module.exports.pushToAlgolia2 = (event, context, callback) => {
  console.log(event);

  const list = event.Records;

  const iteratee = (record, key, cb) => {
    let retrievedRecord = new Buffer(record.kinesis.data, 'base64').toString();
    let universityInfo = JSON.parse(retrievedRecord);

    console.log('Pushing to Algolia: ' + universityInfo.name + universityInfo.course.name);

    helper.addToAlgolia(universityInfo)
      .then(() => {
        cb();
      })
      .catch(err => {
        cb(err);
      });
  };

  eachOf(list, iteratee, function(err) {
    if (err) {
      callback(err);
    }
    callback(null, 'Number of RECs pushed to algolia: ' + list.length);
  });
};

// /menu?category=graduate
module.exports.getMenu = (event, context, callback) => {
  const category = event.queryStringParameters.category;

  if (!category) {

    const response = {
      statusCode: 400,
      body: 'Invalid request'
    };

    callback(null, response);

  } else {
    helper.getMenu(category)
      .then(menuResults => {
        const response = {
          statusCode: 200,
          body: JSON.stringify(menuResults)
        };

        callback(null, response);
      });
  }

};

// /universities/:id
module.exports.getUniversityById = (event, context, callback) => {
  console.log(event);

  const id = event.pathParameters.id;

  if (!id) {
    const response = {
      statusCode: 400,
      body: 'Invalid request'
    };

    callback(null, response);
  } else {
    helper.getById(id)
      .then(university => {

        const response = {
          statusCode: 200,
          body: JSON.stringify(university)
        };

        callback(null, response);
      });
  }

};

// /universities?name=computer%20science&level=graduate&gre=200
module.exports.search = (event, context, callback) => {
  const queryParams = event.queryStringParameters;
  console.log(queryParams);
  if (queryParams) {
    helper.searchByFilters(queryParams)
      .then(result => {

        const response = {
          statusCode: 200,
          body: JSON.stringify(result)
        };

        callback(null, response);
      });
  } else {
    const response = {
      statusCode: 400,
      body: 'Invalid request'
    };

    callback(null, response);
  }
};
