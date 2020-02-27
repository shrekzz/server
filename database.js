const mysql = require('mysql');
const config = require('./config');

const database = mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    multipleStatements: true
});

database.connect();
console.log('connected success')


database._query = function( sql ) {
  // 返回一个 Promise
  return new Promise(( resolve, reject ) => {
    database.query(sql, ( err, rows) => {
        if ( err ) {
        reject( err )
        } else {
        resolve( rows )
        }
    })
  })
}

module.exports = database;