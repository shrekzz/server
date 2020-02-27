var express = require('express');
var router = express.Router();
var mysql = require('./../database');
var moment = require('moment');
let db = require("./../database");

var app = express();
var bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
/* GET home page. */
router.get('/index', function(req, res, next) {
  let user = req.query.user
  let page = parseInt(req.query.page)
  let draft =  req.query.draft
  let pageSize = parseInt(req.query.pageSize)
  let skip = (page-1)*pageSize
  let query = (user == null) ? 'SELECT * FROM article WHERE draftFlag = 0 ORDER BY articleTime DESC LIMIT ' + skip+',' +pageSize : 'SELECT * FROM article WHERE articleAuthor ="'+ user+'" AND draftFlag = 0 ORDER BY articleTime DESC LIMIT ' + skip+',' +pageSize
  if(draft == 'draft'){
	 query = 'SELECT * FROM article WHERE articleAuthor ="'+ user+'" AND draftFlag = 1 ORDER BY articleID DESC LIMIT ' + skip+',' +pageSize
  }
  mysql.query(query, function(err, rows, fields) {
    var articles = rows;
	if(!articles){
		return
	}
    articles.forEach( item => {
      item.articleTime = moment(item.articleTime).format()
    })
    if(err){
      res.json({
        status: '1',
        msg:'err.message'
      })
    }else{
      res.json({
        status: '0',
        msg:'',
        result: {articles: articles, count: articles.length}
      })
    }
  });
});

//根据ID获取name
router.post('/index/name2id', async (req, res) => {
  let authorName = req.body.authorName
  const sql = 'SELECT authorID FROM author WHERE  authorName = ' + db.escape(authorName)
  let id = (await db._query(sql))[0]
  try {
    res.json({
      status: '1',
      result: id
    })
  } catch (error) {
    res.json({
      status: '0',
      error
    })
  }
})



module.exports = router;
