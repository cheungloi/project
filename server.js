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
app.get('/rate', function(req, res){
	var id = req.query.id;
	var name = req.query.name;
	res.render("rate.ejs", {id:id,name:name});
});
app.get('/showinfo',function(req,res) {
	MongoClient.connect(mongourl, function(err, db){
		assert.equal(err, null);
		var criteria = {"_id":ObjectId(req.query.id)};
		findrestaurant(db, criteria, function(restaurants){
			db.close();
			console.log(restaurants);
			res.render('info',{r:restaurants});
			//res.end();
		});
	});
});

app.get('/index',function(req,res) {
	if (!req.session.authenticated) {
		res.redirect('/login');
	}else{
		MongoClient.connect(mongourl, function(err, db){
			assert.equal(err, null);
			console.log('connecting to restaurants');
			var criteria = null;
			listrestaurant(db, criteria, function(restaurants){
				db.close();
				res.render('index',{r:restaurants, u:req.session.username});
				//res.end();
			});
		});
	}
});
app.get('/search', function(req,res){
	var criteria = req.query.keyword;	
	MongoClient.connect(mongourl, criteria, function(err, db){
		assert.equal(err, null);
		console.log('connecting to restaurants');
		listrestaurant(db, criteria, function(restaurants){
			db.close();
			res.render('index',{r:restaurants, u:req.session.username});
		//req.end();
		});
	});
});

app.get('/delete', function(req,res){
	if(req.query.owner !== req.session.username){
        res.send('You are not owner.');
        return;
    }
    var criteria = {"_id":ObjectId(req.query.id)};
    MongoClient.connect(mongourl, function(err, db){
    	assert.equal(err,null);
    	delrestaurant(db, criteria, function(result){
    		db.close();
    		res.redirect('/index');
    	});
    });
});

app.get('/changeinfo', function(req, res){
	MongoClient.connect(mongourl, function(err, db){
		assert.equal(err, null);
		var criteria = {"_id":ObjectId(req.query.id)};
		findrestaurant(db, criteria, function(restaurants){
			db.close();
			console.log(restaurants);
			if(restaurants.owner !== req.session.username){
				var error = "You are not authorized to edit!!!";
				res.render('error',{error:error});
				//res.send('You are not authorized to edit!!!');	
			}else{
				res.render('editinfo',{r:restaurants});
			}	
		});
	});
});
app.get('/showmap', function(req,res){
	var lat = req.query.lat;
	var lon = req.query.lon;
	var zoom = 18;
	var name = req.query.name;
	res.render("gmap.ejs",{lat:lat,lon:lon,zoom:zoom,name:name});
	res.end();
});

app.get('/ratemark', function(req,res){
	var criteria1 = {"_id":ObjectId(req.query.id)};
	var criteria2 = {"rate":{"name":req.session.username, "mark":req.query.rate}};
	var criteria3 = {$push:criteria2};
	console.log(criteria3);
	MongoClient.connect(mongourl,function(err,db) {
      console.log('Connected to mlab.com');
      assert.equal(null,err);
      checkrate(db, criteria1, req.session.username, function(result){
      	db.close();
      	if(result == 'a'){
      		MongoClient.connect(mongourl,function(err,db) {
      		console.log('Connected to mlab.com');
      		assert.equal(null,err);
      			updaterestaurant(db, criteria1, criteria3, function(result){
    			db.close();
    			res.redirect('/showinfo?id='+req.query.id);
    			});
    		});
    	}else{
    		var error = "You have gave rate";
			res.render('error',{error:error});
    	}  	
	  });
	});
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
app.post('/changeinfo', function(req,res){
	//console.log(req.files.rphoto.name);
	var criteria1 = {"_id":ObjectId(req.body.id)};
	var criteria2 = {};
	criteria2['name'] = req.body.name;
	criteria2['borough'] = req.body.borough;
	criteria2['cuisine'] = req.body.cuisine;
	criteria2['address'] = {};
	criteria2.address.street = req.body.street;
	criteria2.address.building = req.body.building;
	criteria2.address.zipcode = req.body.zipcode;
	criteria2.address['gps'] = [];
	criteria2.address.gps.push(req.body.lat);
	criteria2.address.gps.push(req.body.lon);
	if(req.files.rphoto.name){
		criteria2['data'] = new Buffer(req.files.rphoto.data).toString('base64');
		criteria2['mimetype'] = req.files.rphoto.mimetype;	
	}
	var criteria3 = {$set:criteria2};
	//console.log(criteria3);
	MongoClient.connect(mongourl,function(err,db) {
      console.log('Connected to mlab.com');
      assert.equal(null,err);
      updaterestaurant(db, criteria1, criteria3, function(result){
    		db.close();
    		res.redirect('/showinfo?id='+req.body.id);
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
          res.send('create success');
          //res.redirect('/login');
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

function listrestaurant(db, criteria, callback){
	if (!criteria){
		db.collection('restaurants').find().toArray(function(err, result){
			assert.equal(err,null);
			callback(result);
	});
	}else{
		var keyword = '\.*'+criteria+'\.*';
		db.collection('restaurants').find({name:new RegExp(keyword, 'i')}).toArray(function(err, result){
			assert.equal(err,null);
			callback(result);
	});
}
}
function findrestaurant(db, criteria, callback){
	db.collection('restaurants').findOne(criteria, function(err, result){
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
function updaterestaurant(db, criteria1, criteria2, callback){
	console.log(criteria1);
	console.log(criteria2);
	db.collection('restaurants').updateOne(criteria1, criteria2, function(err,result){
		if (err) {
      			result = err;
      			console.log("updateOne error: " + JSON.stringify(err));
    		} else {
      			console.log("update success");
    		}
    		callback(result);
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
	r.address.gps.push(body.lat);
	r.address.gps.push(body.lon);
	r['owner'] = owner;
	r['rate'] = [];
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

function checkrate(db, criteria, user, callback){
	console.log(user);
	var result = 'a';

	db.collection('restaurants').findOne(criteria, function(err, doc){
		assert.equal(err,null);
		console.log(doc.rate);
		if(doc.rate !== null){
			console.log("rate is not null");
			for(var i=0;i<doc.rate.length;i++){
				if (doc.rate[i].name == user){
				result = 'b';
				//callback(result);
				}
			}
		}else{
		console.log("rate is null");
	}
		callback(result);
	});
}
function delrestaurant(db, criteria, callback){
	db.collection('restaurants').remove(criteria,function(err,result) {
	console.log("delete success");
	callback(result);
	});
}

app.listen(process.env.PORT || 8099);