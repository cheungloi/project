var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var app = express();

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://loicheung:19940319@ds043694.mlab.com:43694/s381f';


app = express();

var SECRETKEY1 = 'loi';
var SECRETKEY2 = 'cheung';

app.set('view engine','ejs');

app.use(session({
  name: 'session',
  keys: [SECRETKEY1,SECRETKEY2]
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

app.get('/',function(req,res) {
	console.log(req.session);
	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	res.status(200).end('Hello, ' + req.session.username +
	  '!  This is a secret page!');
});

app.get('/login',function(req,res) {
	res.sendFile(__dirname + '/public/login.html');
});
app.get('/create',function(req,res) {
	res.sendFile(__dirname + '/public/create.html');
});
app.post('/login',function(req,res) {
	if(req.body.id == null || req.body.pw == null){
		res.send('cannot empty');
		return;
	}
	MongoClient.connect(mongourl, function(err,db){
		console.log('connecting to mlab');
		assert.equal(null,err);
		login(db, req.body.id, req.body.pw, function(result){
			db.close();
			if(result){
				res.status(200);
          		req.session.authenticated = true;
				req.session.username = req.body.id; 
				res.redirect('/');
				res.end('login sucess');
			}else{
				res.status(500);
          		res.end('login fail');
			}
		});
	});
});
app.post('/create', function(req,res){
	if(req.body.id == null || req.body.pw == null){
		res.send('cannot empty');
		return;
	}
	console.log(req.body.id);
	MongoClient.connect(mongourl, function(err,db){
		console.log('connecting to mlab');
		assert.equal(null,err);
		create(db, req.body.id, req.body.pw, function(result){
			db.close();
        if (result.insertedId != null) {
          res.status(200);
          res.end('Inserted: ' + result.insertedId)
        } else {
          res.status(500);
          res.end(JSON.stringify(result));
        }
      });
    });
});
app.get('/logout',function(req,res) {
	req.session = null;
	res.redirect('/');
});

function login(db, id, pw, callback){
	var id = id;
	var pw = pw;
	var result = false;
	db.collection('user').findOne({'username':id}, function(err,doc){
		assert.equal(err,null);
		if(doc != null){
			if(doc.password == pw){
				result = true;			
			}
		}
		callback(result);
	});
}

function create(db, id, pw, callback){
	var id = id;
	var pw = pw;
	db.collection('user').findOne({'username':id}, function(err,doc) {
		assert.equal(err, null);
		if(doc !== null){
			callback('id is used');
		}else{
			db.collection('user').insertOne(
				{"username":id,
				"password":pw}, function(err,result){
				if (err) {
      				console.log('insertOne Error: ' + JSON.stringify(err));
      				result = err;
    			} else {
      				console.log("Inserted _id = " + result.insertId);
    			}
    			callback(result);
			});
		}
	});
}

app.listen(process.env.PORT || 8099);