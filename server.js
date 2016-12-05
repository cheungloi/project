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
var watson = require('watson-developer-cloud');
var visual_recognition = watson.visual_recognition({
  api_key: '48aec928ba8beef4f317e367995107b269704976',
  version: 'v3',
  version_date: '2016-05-20'
});


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

app.use('/style', express.static('style'));

app.post('/api/create', function(req, res){
	var reresult = {};
	var r = {};
	console.log(req.body.name);
	if(!req.body.name || !req.body.owner){
		reresult['status'] = 'fail';
		res.status(500);
		res.send(reresult);
		res.end();		
	}
	console.log("else part");
	r['name'] = req.body.name;
	r['borough'] = req.body.borough;
	r['cuisine'] = req.body.cuisine;
	r['address'] = {};
	r.address.street = req.body.street;
	r.address.building = req.body.building;
	r.address.zipcode = req.body.zipcode;
	r.address['gps'] = [];
	r.address.gps.push(req.body.lat);
	r.address.gps.push(req.body.lon);
	r['owner'] = req.body.owner;
	r['rate'] = [];
	if(req.files && req.files.rphoto.mimetype.match('image')){
	r['data'] = new Buffer(req.files.rphoto.data).toString('base64');
	r['mimetype'] = req.files.rphoto.mimetype;
	}
	console.log(r);
    MongoClient.connect(mongourl,function(err,db) {
      console.log('Connected to mlab.com');
      assert.equal(null,err);
    	createrestaurant(db, r, function(result){
    		db.close();
    		console.log('close connection');
    		if (result.insertedId) {
            reresult['status'] = 'ok';
            reresult['_id'] = result.insertedId;
            console.log(reresult);
            res.status(200);
            res.send(reresult);
			res.end();
          } else {
            reresult['status'] = "fail";
			res.writeHead(500);
			res.send(reresult);
			res.end();
          }
    	});
	});
});
app.get('/api/read', function(req,res){
	MongoClient.connect(mongourl, function(err, db){
		assert.equal(err, null);
		console.log('connecting to restaurants');
		var criteria = null;
		listrestaurant(db, criteria, function(restaurants){
			db.close();
			res.send(restaurants);
			res.end();
		});
	});
});
app.get('/api/read/:criteria1/:criteria2', function(req,res){
	var criteria = {};
	criteria[req.params.criteria1] = req.params.criteria2;
	console.log(criteria);
	MongoClient.connect(mongourl, criteria, function(err, db){
		assert.equal(err, null);
		console.log('connecting to restaurants');
		listrestaurant(db, criteria, function(restaurants){
			if(!restaurants){
			db.close();
			res.send(restaurants);
			res.end();
		}else{
			res.send({});
			res.end();
		}
		});
	});
});
app.get('/',function(req,res) {
	console.log(req.session);
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
			});
		});
	}
});
app.get('/search', function(req,res){
	var criteria = {$or:[{name:new RegExp(req.query.keyword, 'i')},{borough:new RegExp(req.query.keyword, 'i')},{cuisine:new RegExp(req.query.keyword, 'i')}]};
	MongoClient.connect(mongourl, criteria, function(err, db){
		assert.equal(err, null);
		console.log('connecting to restaurants');
		listrestaurant(db, criteria, function(restaurants){
			db.close();
			res.render('index',{r:restaurants, u:req.session.username});
		});
	});
});

app.get('/delete', function(req,res){
	if(req.query.owner !== req.session.username){
        var error = 'You are not owner.';
		res.render('error',{error:error});
        
    }
    var criteria = {"_id":ObjectId(req.query.id)};
    MongoClient.connect(mongourl, function(err, db){
    	assert.equal(err,null);
    	delrestaurant(db, criteria, function(result){
    		db.close();
    		var message = "delete success!!!";
          	var url = "index"
          	res.render('message',{m:message, url:url});
    	});
    });
});

app.get('/changeinfo', function(req, res){
	if(req.query.owner !== req.session.username){
		var error = "You are not authorized to edit!!!";
		res.render('error',{error:error});
		return;
	}
	MongoClient.connect(mongourl, function(err, db){
		assert.equal(err, null);
		var criteria = {"_id":ObjectId(req.query.id)};
		findrestaurant(db, criteria, function(restaurants){
			db.close();
			res.render('editinfo',{r:restaurants});
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
      	if(result){
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
	console.log('/create');
	if(!req.body.name){
        var error = "name cannot be empty.";
		res.render('error',{error:error});
        return;
    }
	    
   	var r = {};
	r['name'] = req.body.name;
	r['borough'] = req.body.borough;
	r['cuisine'] = req.body.cuisine;
	r['address'] = {};
	r.address.street = req.body.street;
	r.address.building = req.body.building;
	r.address.zipcode = req.body.zipcode;
	r.address['gps'] = [];
	r.address.gps.push(req.body.lat);
	r.address.gps.push(req.body.lon);
	r['owner'] = req.session.username;
	r['rate'] = [];
	if(req.files){
		r['data'] = new Buffer(req.files.rphoto.data).toString('base64');
		r['mimetype'] = req.files.rphoto.mimetype;	
	}	
	console.log(r);
    MongoClient.connect(mongourl,function(err,db) {
      console.log('Connected to mlab.com');
      assert.equal(null,err);
    	createrestaurant(db, r, function(result){
    		db.close();
    		console.log('close connection');
    		if (result.insertedId != null) {
    		console.log(result.insertedId);
            res.status(200);
            res.redirect('/index');
          } else {
            res.status(500);
            res.end(JSON.stringify(result));
          }
    	});
	});
});
app.post('/changeinfo', function(req,res){
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
		if(!req.files.rphoto.mimetype.match('image')){
    	var error = "Files is not image type.";
		res.render('error',{error:error});
        return;
    }
		criteria2['data'] = new Buffer(req.files.rphoto.data).toString('base64');
		criteria2['mimetype'] = req.files.rphoto.mimetype;	
	}
	console.log(criteria2);
	var criteria3 = {$set:criteria2};
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
	if(!req.body.id || !req.body.pw){
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
	if(!req.body.id || !req.body.pw){
		res.send('cannot empty');
		return;
	}
	MongoClient.connect(mongourl, function(err,db){
		console.log('connecting to userdb');
		assert.equal(null,err);
		createac(db, req.body.id, req.body.pw, function(result){
			db.close();
			console.log(result);
        if (result) {
          res.status(200);
          var message = "create success!!!";
          var url = "login"
          res.render('message',{m:message, url:url});
        } else {
          var error = "id is used";
          res.render('error',{error:error});
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
		console.log(criteria)
		db.collection('restaurants').find(criteria).toArray(function(err, result){
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
		if(doc!=null){
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
		if(doc!=null){
			callback(false);
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
    			callback(true);
			});
		}
	});
}
function updaterestaurant(db, criteria1, criteria2, callback){
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
function createrestaurant(db, r, callback){
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
	var result = true;
	db.collection('restaurants').findOne(criteria, function(err, doc){
		assert.equal(err,null);
		console.log(doc.rate);
		if(doc.rate!=null){
			console.log("rate is not null");
			for(var i=0;i<doc.rate.length;i++){
				if (doc.rate[i].name == user){
				result = false;
				}
			}
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