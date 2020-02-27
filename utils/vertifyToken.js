const jwt = require("jsonwebtoken");
let fs = require("fs");
const path = require("path");


//生成TOKEN
exports.setToken = (userid, username) => {
    const cert = fs.readFileSync(path.resolve(__dirname, "../jwt.pem"));
    return new Promise((resolve, reject) => {
        const token = jwt.sign(
                        {
                            id:userid,
                            name:username  
                        },
                        cert,
                        {
                            algorithm: "RS256",
                            expiresIn: 24 * 60 * 60
                        }
                    );
        resolve(token);
        reject('token生成错误')
    })
}
//解析TOKEN
exports.verToken = (token) => {
    const vercert = fs.readFileSync(path.resolve(__dirname, "../jwt_pub.pem"));
    return new Promise((resolve, reject) => {
        let result = jwt.verify(token, vercert);
        resolve(result)
        reject('解析错误')
    })
}