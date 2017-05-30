//  OpenShift sample Node application
var express = require('express'),
    fs      = require('fs'),
    app     = express(),
    eps     = require('ejs'),
    morgan  = require('morgan');

var bodyParser = require('body-parser');
    
Object.assign=require('object-assign')

app.engine('html', require('ejs').renderFile);
app.use(bodyParser.json());
app.use(morgan('combined'))

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

  }
}
var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  if (mongoURL == null) return;

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);
  });
};

app.post('/sac', function (req, res) {
  //res.send(req.body);
  var mainObj = {}
  mainObj.nome = "Cálculo de amortização"
  mainObj.valorFinanciado = req.body.valor;
  mainObj.taxa = req.body.taxa;
  mainObj.prazo = req.body.prazo;
  
  mainObj.parcelas = {};

  saldo = mainObj.valorFinanciado;
  currentTx = mainObj.taxa;
  prazo = mainObj.prazo;

  amortizacao = Math.round(saldo / prazo * 100) / 100;
  

  for (var i=1; i <= prazo; i++){
      mainObj.parcelas[i] = {}
      mainObj.parcelas[i].saldoInicial = Math.round((saldo + (Math.round(saldo * (currentTx / 12 / 100) * 100) / 100)) * 100) / 100;
      mainObj.parcelas[i].amortizacao = amortizacao;
      mainObj.parcelas[i].juros = Math.round(saldo * (currentTx / 12 / 100) * 100) / 100;
      mainObj.parcelas[i].valorParcela = Math.round((mainObj.parcelas[i].juros + mainObj.parcelas[i].amortizacao) * 100) / 100;

      saldo = saldo - mainObj.parcelas[i].amortizacao;

      if (mainObj.parcelas[i].valorParcela > mainObj.parcelas[i].saldoInicial){
          mainObj.parcelas[i].valorParcela = mainObj.parcelas[i].saldoInicial;
          saldo = 0;
      }

      mainObj.parcelas[i].saldoPosAmortizacao = Math.round(saldo * 100) / 100;

      mainObj.parcelas[i].amortizacaoAdicional = 0;
      mainObj.parcelas[i].saldoFinal = mainObj.parcelas[i].saldoPosAmortizacao;

      if ((req.body.amortization != undefined) && (req.body.amortization[i] != undefined)){
          reducedQty = Math.round(req.body.amortization[i].amount / mainObj.parcelas[i].amortizacao);
          prazo = prazo - reducedQty;

          mainObj.parcelas[i].amortizacaoAdicional = req.body.amortization[i].amount;
          mainObj.parcelas[i].saldoFinal = mainObj.parcelas[i].saldoFinal - req.body.amortization[i].amount;
          saldo = mainObj.parcelas[i].saldoFinal;

          //amortizacao = Math.round(saldo / (prazo - i) * 100) / 100;
      }

      if (saldo <= 0 ){
          break;
      }

  }
  
  res.send(mainObj);
});

app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      res.render('index.html', { pageCountMessage : count, dbInfo: dbDetails });
    });
  } else {
    res.render('index.html', { pageCountMessage : null});
  }
});

app.get('/pagecount', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection('counts').count(function(err, count ){
      res.send('{ pageCount: ' + count + '}');
    });
  } else {
    res.send('{ pageCount: -1 }');
  }
});

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
