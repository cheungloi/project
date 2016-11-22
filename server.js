var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var fileUpload = require('express-fileupload');
var app = express();
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://loicheung:19940319@ds043694.mlab.com:43694/s381f';
var app = express();


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
app.use(fileUpload());

app.get('/',function(req,res) {
	console.log(req.session);
	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	res.status(200).end('Hello, ' + req.session.username +
	  '!  This is a secret page!');
});

app.get('/add',function(req,res) {
	res.sendFile(__dirname + '/public/add.html');
});

app.get('/login',function(req,res) {
	res.sendFile(__dirname + '/public/login.html');
});

app.get('/create',function(req,res) {
	res.sendFile(__dirname + '/public/create.html');
});

app.get('/index',function(req,res) {
	if (!req.session.authenticated) {
		res.redirect('/login');
	}else{
		MongoClient.connect(mongourl, function(err,db){
			assert.equal(err, null);
			console.log('connecting to restaurants');
			listrestaurant(db, function(restaurants){
				db.close();
				res.render('index',{r:restaurants, u:req.session.username});
			});
		});
	}
});

app.post('/addrestaurant', function(req, res){
	var rphoto;
	if(req.body.rname == null){
        res.send('name cannot be empty.');
        return;
    }
	if(!req.files){
        res.send('No photo were uploaded.');
        return;
    }    	
   // console.log(req.files);
    MongoClient.connect(mongourl,function(err,db) {
      console.log('Connected to mlab.com');
      assert.equal(null,err);
    	createrestaurant(db, req.files.rphoto, req.body, req.session.username, function(result){
    		db.close();
    		console.log('close connection');
    		if (result.insertedId != null) {
            res.status(200);
            res.end('Inserted: ' + result.insertedId);
          } else {
            res.status(500);
            res.end(JSON.stringify(result));
          }
    	});
	});
});


app.post('/login',function(req,res) {
	if(req.body.id == null || req.body.pw == null){
		res.send('cannot empty');
		return;
	}
	MongoClient.connect(mongourl, function(err,db){
		console.log('connecting to userdb');
		assert.equal(null,err);
		login(db, req.body.id, req.body.pw, function(result){
			db.close();
			if(result){
				res.status(200);
          		req.session.authenticated = true;
				req.session.username = req.body.id; 
				res.redirect('/index');
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
		console.log('connecting to userdb');
		assert.equal(null,err);
		createac(db, req.body.id, req.body.pw, function(result){
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

function listrestaurant(db, callback){
	db.collection('restaurants').find().toArray(function(err, result){
		assert.equal(err,null);
		callback(result);
	});
}

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

function createac(db, id, pw, callback){
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

function createrestaurant(db, bfile, body, owner, callback){
	var r = {};
	r['name'] = body.rname;
	r['borough'] = body.borough;
	r['cuisine'] = body.cuisine;
	r['address'] = {};
	r.address.street = body.street;
	r.address.building = body.building;
	r.address.zipcode = body.zipcode;
	r.address['gps'] = [];
	r.address.gps.push(body.lon);
	r.address.gps.push(body.lat);
	r['owner'] = owner;
	r['rate'] = 0;
	r['data'] = new Buffer(bfile.data).toString('base64');
	r['mimetype'] = bfile.mimetype;
	console.log(r);
	db.collection('restaurants').insertOne(r, function(err,result) {
    		if (err) {
      			result = err;
      			console.log("insertOne error: " + JSON.stringify(err));
    		} else {
      			console.log("Inserted _id = " + result.insertedId);
    		}
    		callback(result);
    		});
}
app.listen(process.env.PORT || 8099);