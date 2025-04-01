const express = require ('express');
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');

const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');



const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './public/images/uploads')
    },
    filename: function (req, file, cb) {

        crypto.randomBytes(12, function(err,bytes){
            const fn = bytes.toString("hex");
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            cb(null, file.fieldname + '-' + uniqueSuffix) + path.extname(file.originalname)
            cb(null, fn)
        })
        
    }
  })
  
const upload = multer({ storage: storage }) 


app.set("view engine","ejs");
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());


app.get('/', function(req,res){
    res.render("index");
});

app.get('/login', function(req,res){
    res.render("login");
});

app.get('/test', function(req,res){
    res.render("test");
});

app.post('/upload', upload.single("image"), function(req,res){
    console.log(req.file);
});

app.get('/profile', isloggedin,  async function(req,res){

    let user = await userModel.findOne({email: req.user.email }).populate("posts");
    console.log(user);
    res.render("profile",{user});
});

app.get('/like/:id', isloggedin,  async function(req,res){

    let post = await postModel.findOne({_id: req.params.id }).populate("user");

    if(post.likes.indexOf(req.user.userid) ===-1) {
        post.likes.push(req.user.userid);
    }
    else{
        post.likes.splice(post.likes.indexOf(req.user.userid), 1);
    }
    
   
    await post.save();
    res.redirect("/profile");
});

app.get('/edit/:id', isloggedin,  async function(req,res){

    let post = await postModel.findOne({_id: req.params.id }).populate("user");

    res.render("edit",{post});
});

app.post('/update/:id', isloggedin,  async function(req,res){

    let post = await postModel.findOneAndUpdate({_id: req.params.id },{content: req.body.content})

    res.redirect("/profile");
});

app.post('/post', isloggedin,  async function(req,res){

    let user = await userModel.findOne({email: req.user.email });
    let{content} = req.body;

    let post = await postModel.create({
        user: user._id,
        content
    });

    user.posts.push(post._id);
    await user.save();
    res.redirect("/profile");
});


app.post('/register', async function (req, res) {
    try {
        let { email, password, username, name, age } = req.body;

        let user = await userModel.findOne({ email });
        if (user) return res.status(400).send("User already registered");

        console.log("Original Password:", password);

        // ✅ Ensure the password is hashed properly
        const hash = await bcrypt.hash(password, 10);

        console.log("Hashed Password:", hash);  // Should be 60 characters long

        user = await userModel.create({
            username,
            email,
            age,
            name,
            password: hash  // Store the full hash
        });

        let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
        res.cookie("token", token);
        res.send("Registered successfully");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error registering user");
    }
});


app.post('/login', async function (req, res) {
    try {
        let { email, password } = req.body;

        let user = await userModel.findOne({ email });
        if (!user) return res.status(500).send("Something went wrong");

        console.log("Entered Password:", password);
        console.log("Stored Hashed Password:", user.password);

        // ✅ Use await properly
        let isMatch = await bcrypt.compare(password, user.password);

        console.log("Password Match:", isMatch);

        if (isMatch) {
            let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
            res.cookie("token", token);
            res.status(200).redirect("/profile");
        } else {
            res.status(400).send("Incorrect password");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Error logging in");
    }
});

app.get('/logout', function(req,res){
    res.cookie("token", "");
    res.redirect("/login");
});

function isloggedin(req, res, next){
    if(req.cookies.token === "") res.redirect("/login");
    else{
        let data = jwt.verify(req.cookies.token, "shhhh");
        req.user = data;
        next();
    }
}


app.listen(3000);