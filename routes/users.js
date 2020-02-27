const jwt = require("jsonwebtoken");
const uuid = require("node-uuid");
const verifyToken = require("../utils/vertifyToken")

let express = require("express");
let router = express.Router();
let crypto = require("crypto");
let db = require("./../database");
let moment = require("./../node_modules/moment/min/moment-with-locales");

let fs = require("fs");
const path = require("path");
let multer = require("multer");

let app = express();
let bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
/* GET users listing. */
router.get("/", function(req, res, next) {
  res.send("respond with a resource");
});

module.exports = router;

/* 登录页 */
router.get("/login", function(req, res, next) {
  res.render("login", { message: "" });
});

router.post("/login", function(req, res, next) {
  let name = req.body.userName;
  let password = req.body.userPwd;
  let hash = crypto.createHash("md5");
  hash.update(password);
  password = hash.digest("hex");
  let query =
    "SELECT * FROM author WHERE authorName =" +
    db.escape(name) +
    " AND authorPassword =" +
    db.escape(password);
  db.query(query,async function(err, rows) {
    if (err) {
      console.log(err);
      return;
    }
    let user = rows[0];

    if (!user) {
      res.json({
        status: "1",
        msg: "用户名或密码错误"
      });
    } else {
      //生成token
      let token = await verifyToken.setToken(user.authorID, user.authorName)
      res.cookie("authorID", user.authorID, {
        path: "/",
        maxAge: 60000 * 60 * 24 * 7
      });
      res.cookie("authorName", user.authorName, {
        path: "/",
        maxAge: 60000 * 60 * 24 * 7
      });
      res.json({
        status: "0",
        msg: "",
        result: {
          user: user.authorName,
          avatarUrl: user.authorAvatarUrl,
          userID: user.authorID,
          followers: user.followers.split(','),
          fans: user.fans.split(','),
          token: token
        }
      });
    }
  });
});

router.post("/logout", function(req, res, next) {
  res.cookie("authorID", "", {
    path: "/",
    maxAge: -1
  }),
    res.cookie("authorName", "", {
      path: "/",
      maxAge: -1
    });
  res.json({
    status: "0",
    msg: "",
    result: ""
  });
});
//
router.get("/checklogin", function(req, res, next) {
  let token = req.query.token;
  //hrome（webkit核心浏览器）默认只支持online-cookie（网站发布，通过http协议访问设置的cookie），本地测试（file浏览，双击运行或者拖进chrome浏览器）设置的cookie是无法保存的
  //要想chrome本地设置的cookie也要能保存，需要配置过chrome，给chrome快捷方式添加 --enable-file-cookies启动参数，右键点击chrome桌面快捷图标，属性，在目标最后添加--enable-file-cookies启动参数，注意--前面要有空格。
  if (token && req.cookies.authorName) {
    let cert = fs.readFileSync(path.resolve(__dirname, "../jwt_pub.pem"));
    const decode = jwt.verify(token, cert);
    res.json({
      status: "0",
      msg: decode
    });
  } else {
    console.log("是我的问题");
    res.json({
      status: "1",
      msg: "未登录",
      result: ""
    });
  }
});
//注册
router.post("/regist", function(req, res, err) {
  const createuuid = uuid.v1().toString();
  let name = req.body.name;
  let pwd = req.body.pwd;
  let phone = req.body.phone;

  let hash = crypto.createHash("md5");
  hash.update(pwd);
  pwd = hash.digest("hex");
  let query =
    "INSERT INTO author SET authorID =" +
    db.escape(createuuid) +
    ", authorName =" +
    db.escape(name) +
    ", authorPassword =" +
    db.escape(pwd) +
    ", authorPhone =" +
    db.escape(phone);
  console.log(query);
  db.query(query, function(err, rows, fields) {
    if (err) {
      res.json({
        status: "1",
        msg: err.message
      });
    } else {
      res.json({
        status: "0",
        msg: "注册成功！"
      });
    }
  });
});

router.post("/getArticleCount", async (req, res) => {
  let articleAuthor = req.body.articleAuthor
  const sql = 'SELECT count(*) AS count FROM article WHERE draftFlag = 0 AND articleAuthor = ' + db.escape(articleAuthor)
  res.json({
    status: '1',
    result: (await db._query(sql))[0].count
  })
})

router.post("/articleContent", function(req, res, next) {
  let articleID = req.body.articleID;
  let query = "SELECT * FROM article WHERE articleID=" + db.escape(articleID);
  let edit = req.body.edit;
  db.query(query, function(err, rows, fields) {
    if (err) {
      console.log(err);
      return;
    }
    let query =
      "UPDATE article SET articleClick = articleClick + 1 WHERE articleID = " +
      db.escape(articleID);
    let article = rows[0];
    article.articleTime = moment(article.articleTime).format("YYYY-MM-DD");
    if (edit == undefined) {
      db.query(query, function(err, rows, fields) {
        if (err) {
          console.log(err);
          return;
        }
      });
    }
    res.json({
      status: "0",
      msg: "",
      result: { article: article }
    });
  });
});

//发布编辑删除文章、保存编辑删除草稿
router.post("/editArticle", async (req, res) => {
  let title = req.body.title;
  let content = req.body.content;
  let author = req.cookies.authorName;
  let articleID = req.body.articleID;
  let draftFlag = parseInt(req.body.draftFlag); //0：不是草稿； 1：是草稿
  if (!articleID) {
    //id为空，即为第一次保存或者自动保存，文章还不存在
    //新建一个ID
    //然后把id传回，用这个ID来更新文章
    const createuuid = uuid.v1().toString();
    const query =
      "INSERT article SET articleTitle = " +
      db.escape(title) +
      ", articleAuthor = " +
      db.escape(author) +
      ", articleContent = " +
      db.escape(content) +
      ",  draftFlag = " +
      db.escape(draftFlag) +
      ", articleTime = NOW() , articleID = " +
      db.escape(createuuid);
    await db._query(query);
    try {
      res.json({
        status: "1",
        msg: 'returned id',
        result: { articleID: createuuid }
      });
    } catch (err) {
      res.json({
        status: "0",
        msg: err
      });
    }
  } else {
    const query =
      "UPDATE article SET articleTitle = " +
      db.escape(title) +
      ", articleAuthor = " +
      db.escape(author) +
      ", articleContent = " +
      db.escape(content) +
      ", articleTime = NOW(), draftFlag = " +
      db.escape(draftFlag) +
      " WHERE articleID = " +
      db.escape(articleID);
    await db._query(query);
    try {
      res.json({
        status: "1",
        msg: "succ"
      });
    } catch (err) {
      res.json({
        status: "0",
        msg: err
      });
    }
  }
});

//删除文章及其评论
router.post("/delete", async (req, res) => {
  let articleID = req.body.articleID;
  let query = "DELETE FROM article WHERE articleID = " + db.escape(articleID);
  await db._query(query);
  try {
    res.json({
      status: "1",
      msg: "suc"
    });
  } catch (err) {
    res.json({
      status: "0",
      msg: "success"
    });
  }
});

//获取评论内容
router.post("/getComment", function(req, res, next) {
  let articleID = req.body.articleID;
  let sort = req.body.sort ? "commentTime ASC" : "commentTime DESC";
  let query =
    "SELECT * FROM comment WHERE articleID = " +
    db.escape(articleID) +
    " ORDER BY " +
    sort;
  db.query(query, function(err, rows, fields) {
    if (err) {
      console.log(query);
      res.json({
        status: "1",
        msg: err.message,
        result: ""
      });
    } else {
      let comment = [];
      rows.forEach(item => {
        comment.push(item);
      });

      comment.forEach(item => {
        item.commentTime = moment(item.commentTime).fromNow();
      });

      res.json({
        status: "0",
        msg: "yes",
        result: { commentContent: comment }
      });
    }
  });
});
//发布评论
router.post("/publish", function(req, res, next) {
  let articleID = req.body.articleID;
  let commentID = uuid.v1().toString();
  let authorName = req.cookies.authorName;
  let parentComment = req.body.parentComment;
  let commentContent = req.body.commentContent;
  let avatar = req.body.avatar;
  if (authorName) {
    let query =
      "INSERT comment SET articleID = " +
      db.escape(articleID) +
      ", commentID = " +
      db.escape(commentID) +
      ", commentContent = " +
      db.escape(commentContent) +
      ", authorName = " +
      db.escape(authorName) +
      ", authorAvatarUrl = " +
      db.escape(avatar) +
      ", parentComment = " +
      db.escape(parentComment) +
      ", commentTime = NOW()";
    db.query(query, function(err, rows, fields) {
      if (err) {
        console.log(err);
      } else {
        res.json({
          status: "0",
          msg: "yes",
          result: "success"
        });
      }
    });
  } else {
    res.json({
      status: "1",
      msg: "未登录！",
      result: "failed"
    });
  }
});

//点赞
router.post("/like", function(req, res, next) {
  let articleID = req.body.articleID;
  let likers = req.body.likers;
  let authorName = req.cookies.authorName;
  if (authorName) {
    let query =
      "UPDATE article SET likesArr = " +
      db.escape(likers) +
      " WHERE articleID = " +
      db.escape(articleID);
    db.query(query, function(err, rows, fields) {
      if (err) {
        console.log(err);
      } else {
        res.json({
          status: "0",
          msg: "yes",
          result: "success"
        });
      }
    });
  } else {
    res.json({
      status: "1",
      msg: "未登录！",
      result: "failed"
    });
  }
});

let createFolder = function(folder) {
  try {
    fs.accessSync(folder);
  } catch (e) {
    fs.mkdirSync(folder);
  }
};

let uploadFolder = "./public/images/";

createFolder(uploadFolder);

const storage = multer.diskStorage({
  // 用来配置文件上传的位置
  destination: (req, file, cb) => {
    // 调用 cb 即可实现上传位置的配置
    cb(null, "./public/images");
  },
  // 用来配置上传文件的名称（包含后缀）
  filename: (req, file, cb) => {
    //filename 用于确定文件夹中的文件名的确定。 如果没有设置 filename，每个文件将设置为一个随机文件名，并且是没有扩展名的。
    // 获取文件的后缀
    let ext = file.originalname.substring(file.originalname.lastIndexOf("."));
    // 拼凑文件名
    cb(null, file.fieldname + "-" + Date.now() + ext);
  }
});

const upload = multer({ storage: storage });

router.post("/upload", upload.single("file"), function(req, res, next) {
  let file = req.file;
  let url = "http://localhost:3000/" + file.path.replace(/public\\/, "");

  res.send({
    url: url
  });
});

//头像保存
router.post("/saveAvatar", function(req, res, next) {
  let url = req.body.avatarUrl;
  let authorName = req.body.authorName;
  let query =
    "UPDATE author SET authorAvatarUrl =" +
    db.escape(url) +
    " WHERE authorName =" +
    db.escape(authorName);
  console.log(query);
  db.query(query, function(err, rows, fields) {
    if (err) {
      res.json({ status: "1", msg: err });
    } else {
      res.json({ status: "0", msg: "suc" });
    }
  });
});

//搜索
router.post("/search", async (req, res) => {
  const str = req.body.query;
  let regp = new RegExp(str, "g");
  const reg = `<font color='red'>${str}</font>`;
  const QUERY = `%${req.body.query.split("").join("%")}%`;
  let sql =
    "SELECT * FROM article WHERE articleTitle LIKE " +
    db.escape(QUERY) +
    " OR articleContent LIKE " +
    db.escape(QUERY) +
    ";";
  let sql2 =
    "SELECT authorName, authorAvatarUrl FROM author WHERE authorName LIKE " +
    db.escape(QUERY) +
    ";";
  sql += sql2;
  let resu = (await db._query(sql))[0];
  resu.forEach(item => {
    item.articleContent = item.articleContent.replace(regp, reg);
    item.articleTitle = item.articleTitle.replace(regp, reg);
  });
  try {
    res.json({
      status: "1",
      result: resu
    });
  } catch (err) {
    res.json({
      status: "0",
      res: err
    });
  }
});
//通过ID找username方法
const getName = async id => {
  let finduser =
    "SELECT authorName FROM author WHERE authorID = " + db.escape(id);
  return new Promise((resolve, reject) => {
    db.query(finduser, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows[0].authorName);
      }
    });
  });
};

//个人界面
//用户信息
router.post("/user/message", async (req, res) => {
  let id = req.body.userID;
  const query =
    "SELECT authorID, authorName , authorAvatarUrl , followers , fans , description from author WHERE authorID = " +
    db.escape(id);
  try {
    let result = (await db._query(query))[0];
    result.followers = result.followers.split(",");
    result.fans = result.fans.split(",");

    //过滤为空字符串的
    result.followers.includes("")?result.followers = []:false
    result.fans.includes("")?result.fans = []:false

    res.json({
      status: "1",
      result: result
    });
  } catch (err) {
    console.log(err);
    res.json({
      status: "0",
      msg: err
    });
  }
});
//获取已关注的人
router.post("/user/getUserList", async (req, res) => {
  let userlistsArr = JSON.parse(req.body.userlists);
  const sql = userlistsArr
    .map(item => {
      return `SELECT authorID , authorName , authorAvatarUrl , description FROM author WHERE authorName = '${item}'`;
    })
    .join(";");
    let result = await db._query(sql)
    //对结果进行处理
    //如果有多条记录，result是这样 [[{...记录一...}],[{...记录二...}]]
    //如果只有一条， result [{..记录...}]
    //所以必须对result进行处理，将多条记录时的[]去掉
    let handleResult = []
    if(result.length !== 1){
      result.forEach(item => {
        handleResult.push(item[0])
      })
    }else{
      handleResult = result
    }
  try {
    res.json({
      status: "1",
      result: handleResult
    });
  } catch (err) {
    res.json({
      status: "0",
      msg: err
    });
  }
});
//文章
router.post("/user/articles", async (req, res) => {
  let username = await getName(req.body.userID);
  const query =
    "SELECT * FROM article WHERE draftFlag = 0 AND articleAuthor = " +
    db.escape(username);
  try {
    res.json({
      status: "1",
      result: await db._query(query)
    });
  } catch (err) {
    res.json({
      status: "0",
      msg: err
    });
  }
});
//点赞内容
router.post("/user/likes", async (req, res) => {
  let username = await getName(req.body.userID);
  const query = "SELECT * FROM article WHERE draftFlag = 0";
  //过滤出点赞里有username的
  const handleRes = (await db._query(query)).filter(item => {
    if (item.likesArr === "" || item.likesArr === null) {
      return false;
    }
    return item.likesArr.split(",").includes(username);
  });
  try {
    res.json({
      status: "1",
      result: handleRes
    });
  } catch (err) {
    res.json({
      status: "0",
      msg: err
    });
  }
});

//关注
router.post("/user/follow", async (req, res) => {
  let newFollowers = req.body.newFollowers
  let userID = req.body.userID
  let userName = req.body.userName
  let followedID = req.body.followedID
  let followToggle = req.body.followToggle
  
  const sql = 'UPDATE author SET followers = '+ db.escape(newFollowers) +' WHERE authorID = ' + db.escape(userID)
  await db._query(sql)
  const sql2 = 'SELECT fans FROM author WHERE  authorID = ' + db.escape(followedID)
  //获取被关注人的粉丝列表
  let followedFans = (await db._query(sql2))[0].fans
  //toggle为true就是取关
  if(followToggle){
    let temp = followedFans.split(',')
    let index = temp.indexOf(userName)
    temp.splice(index, 1)
    followedFans = temp.join()
  }else{
    followedFans = (followedFans === '')?userName:(followedFans + `,${userName}`)
  }
  //0粉丝则等于当前用户名，否则就加上用户名
  const sql3 = 'UPDATE author SET fans = ' + db.escape(followedFans) + ' WHERE authorID = ' + db.escape(followedID)
  await db._query(sql3)
  try{
    res.json({
      status: "1",
      msg: "ok"
    })
  }catch(err){
    res.json({
      status: "0",
      msg: "err"
    })
  }
})

//设置
router.post('/settings/profile', async (req, res) => {
  let token = req.headers.authorization
  try {
    let user = await verifyToken.verToken(token)
    let id = user.id
    let updateData =  req.body.updateData
    let type = req.body.type
    const sql = type === 'name'? 'authorName = ' + db.escape(updateData) : 'description = ' + db.escape(updateData)
    const query = 'UPDATE author SET ' + sql + ' WHERE authorID = ' + db.escape(id)     
    await db._query(query)
    res.json({
      status: '1',
      msg: '修改成功!'
    })
  } catch (err) {
    res.json({
      status: '0',
      err,
      msg: '修改失败！'
    })
  }
  
}) 
//修改密码

const verifyPwd = (password) => {
  let hash = crypto.createHash("md5");
  hash.update(password);
  return hash.digest("hex");
}

router.post('/settings/password', async (req, res) => {
  let token = req.headers.authorization
  let nowPwd = verifyPwd(req.body.nowPwd)
  let newPwd = verifyPwd(req.body.newPwd)
  try {
    let user = await verifyToken.verToken(token)
    let id = user.id
    const query = 'SELECT authorPassword FROM author WHERE authorID = ' + db.escape(id)
    //判断密码是否正确，正确再执行下一步操作
    if(nowPwd === (await db._query(query))[0].authorPassword ){
      const query2 = 'UPDATE author SET authorPassword = ' + db.escape(newPwd) + ' WHERE authorID = ' + db.escape(id)
      await db._query(query2)
      res.json({
        status: '1',
        msg: '修改成功'
      })
    }else{
      res.json({
        status: '000',
        msg: '密码错误！'
      })
    }
  } catch (error) {
    res.json({
      status: '0',
      msg: '修改失败'
    })
  }
})
