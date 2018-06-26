'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the expect syntax available throughout
// this module
const expect = chai.expect;

const { BlogPost } = require('../models');
const { app, runServer, closeServer } = require('../server');
const { TEST_DATABASE_URL } = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogPostData() {
  console.info('seeding blog post data');
  const seedData = [];

  for (let i = 1; i <= 10; i++) {
    seedData.push(generateBlogPostData());
  }
  // this will return a promise
  return BlogPost.insertMany(seedData);
}

// generate an object represnting a blog post.
// can be used to generate seed data for db
// or request.body data
function generateBlogPostData() {
  return {
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraph(),
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName()
    },
//    created: faker.date.recent()
  };
}

// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure data from one test does not stick
// around for next one
function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

describe('BlogPost API resource', function () {

  // we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedBlogPostData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function () {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function () {
    return seedBlogPostData();
  });

  afterEach(function () {
    return tearDownDb();
  });

  after(function () {
    return closeServer();
  });

  // note the use of nested `describe` blocks.
  // this allows us to make clearer, more discrete tests that focus
  // on proving something small
  describe('GET endpoint', function () {

    it.only('should return all existing blog posts', function () {
      // strategy:
      //    1. get back all blog posts returned by by GET request to `/posts`
      //    2. prove res has right status, data type
      //    3. prove the number of posts we got back is equal to number
      //       in db.
      //
      // need to have access to mutate and access `res` across
      // `.then()` calls below, so declare it here so can modify in place
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function (_res) {
          // so subsequent .then blocks can access response object
          res = _res;
          expect(res).to.have.status(200);
          // otherwise our db seeding didn't work
          expect(res.body).to.have.lengthOf.at.least(1);
          return BlogPost.count();
        })
        .then(function (count) {
          expect(res.body).to.have.lengthOf(count);
        });
    }); 


    it.only('should return blogposts with right fields', function () {
      // Strategy: Get back all blogposts, and ensure they have expected keys

      let resBlogPost;
      return chai.request(app)
        .get('/posts')
        .then(function (res) {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
         expect(res.body).to.be.a('array');
          expect(res.body).to.be.a('array');
         expect(res.body).to.have.lengthOf.at.least(1);

          // res.body.blogposts.forEach(function (blogpost) {
          res.body.forEach(function (blogpost) {
            expect(blogpost).to.be.a('object');
            expect(blogpost).to.include.keys(
              'id', 'author', 'content', 'title', 'created');
          });
          resBlogPost = res.body[0];
          console.log(`resBlogPost = ${resBlogPost}`)
          return BlogPost.findById(resBlogPost.id);
        })
        .then(function (blogpost) {

          expect(resBlogPost.id).to.equal(blogpost.id);
          expect(resBlogPost.author).to.equal(blogpost.authorName);
          expect(resBlogPost.content).to.equal(blogpost.content);
          expect(resBlogPost.title).to.equal(blogpost.title);
//          expect(resBlogPost.created).to.contain(blogpost.created);
          expect(new Date(resBlogPost.created)).to.contain(new Date(blogpost.created));
        });
    });
  });

  describe.only('POST endpoint', function () {
    // strategy: make a POST request with data,
    // then prove that the blog posts we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it.only('should add a new blog posts', function () {

      const newBlogPost = generateBlogPostData();

      return chai.request(app)
        .post('/posts')
        .send(newBlogPost)
        .then(function (res) {
          expect(res).to.have.status(201);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.include.keys(
            'id', 'author', 'content', 'title', 'created');
          // console.log(`newBlogPost = ${newBlogPost.author.firstName}`);
          // console.log(`newBlogPost = ${newBlogPost.author.lastName}`);
          // console.log(`res.body.authorName=${res.body.authorName}`);
          // expect(res.body).to.equal(newBlogPost.author);
          expect(res.body.author).to.equal(
          `${newBlogPost.author.firstName} ${newBlogPost.author.lastName}`);
          // cause Mongo should have created id on insertion
          expect(res.body.id).to.not.be.null;
          expect(res.body.content).to.equal(newBlogPost.content);
          expect(res.body.title).to.equal(newBlogPost.title);

          return BlogPost.findById(res.body.id);
        })
        .then(function (blogpost) {
          expect(blogpost.author.firstName).to.equal(newBlogPost.author.firstName);
          expect(blogpost.author.lastName).to.equal(newBlogPost.author.lastName);
          expect(blogpost.content).to.equal(newBlogPost.content);
          expect(blogpost.title).to.equal(newBlogPost.title);
        //   console.log(`blogpost.created = ${blogpost.created}`);
        //   console.log(`newBlogPost.created = ${newBlogPost.created}`);
        //   expect(new Date(blogpost.created)).to.equal(new Date(newBlogPost.created));
        });
    });
  });

  describe('PUT endpoint', function () {

    // strategy:
    //  1. Get an existing blogpost from db
    //  2. Make a PUT request to update that blogpost
    //  3. Prove blogpost returned by request contains data we sent
    //  4. Prove blogpost in db is correctly updated
    it.only('should update fields you send over', function () {
      const updateData = {
        author: {
          firstName: 'newFN',
          lastName: 'newLN'
        },
        content: 'Dies irae, Dies illa, Solvet saeclum en favilla, Teste davidcum sybilla.',
        title: 'Requiem Massa'
      };

      return BlogPost
        .findOne()
        .then(function (blogpost) {
          updateData.id = blogpost.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/posts/${blogpost.id}`)
            .send(updateData);
        })
        .then(function (res) {
          expect(res).to.have.status(204);
          return BlogPost.findById(updateData.id);
        })
        .then(function (blogpost) {
          expect(blogpost.author.firstName).to.equal(updateData.author.firstName);
          expect(blogpost.author.lastName).to.equal(updateData.author.lastName);
          expect(blogpost.content).to.equal(updateData.content);
          expect(blogpost.title).to.equal(updateData.title);
        });
    });
  });

  describe('DELETE endpoint', function () {
    // strategy:
    //  1. get a restaurant
    //  2. make a DELETE request for that restaurant's id
    //  3. assert that response has right status code
    //  4. prove that restaurant with the id doesn't exist in db anymore
    it('delete a restaurant by id', function () {

      let restaurant;

      return Restaurant
        .findOne()
        .then(function (_restaurant) {
          restaurant = _restaurant;
          return chai.request(app).delete(`/restaurants/${restaurant.id}`);
        })
        .then(function (res) {
          expect(res).to.have.status(204);
          return Restaurant.findById(restaurant.id);
        })
        .then(function (_restaurant) {
          expect(_restaurant).to.be.null;
        });
    });
  });
});
