const express=require("express");
let app=express();
const port=3003;
const fs=require("fs");
const mongoose=require("mongoose");
const multer=require("multer");
const path=require("path");
const session=require("express-session")
const cookieParser=require("cookie-parser");

const sessionIdtoUserMap=new Map();

app.use(express.static(path.resolve("./public")));       

app.use(express.urlencoded({extended:true}));

app.use(session({
    secret:"secrethiihello",
    resave:false,
    saveUninitialized:true,
}));

// function setUser(id,user){
//     sessionIdtoUserMap.set(id,user);
// }
// setUser('yashsaini0309@gmail.com',{ password: '123', fullname: 'Yashpal' });
// function getUser(id){
//     console.log(sessionIdtoUserMap);
//     return sessionIdtoUserMap.get(id);
// }

app.set('view engine','ejs');
app.set("views",path.resolve("./views"));

// app.use(checkforAuth);

const storage=multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads');
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

app.use(cookieParser());

const upload=multer({storage:storage});

app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/tododata")
.then(()=>{
    console.log("database Connected");
});

const schema=new mongoose.Schema(
    {
        text:{
            type:String,
            required:true
        },
        _id:{
            type:Number,
            required:true
        },
        createdAt:{
            type:Date,
            default:Date.now()
        },
        ImageURL:{
            type:String,
            default:null
        },
        createdBy:{
            type:String,
            required:true,
            default:"Guest",
            ref:"users"
        },
        isCompleted:{
            type:Boolean,
            default:false
        }
    },
    {timestamps:true}
);

const schema2= new mongoose.Schema({
    fullname:{
        type:String,
        required:true
    },
    id:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    }
});



const User=mongoose.model("users",schema2);
const Todo=mongoose.model("todos",schema);

app.get("/",checkforAuth,async (req,res)=>{
    console.log("its get data");
    res.render("home",{
        result:req.session.result,
        user:req.session.user,
    });
});

app.post("/",checkforAuth,upload.single("file"),async (req,res)=>{
    console.log(req.body);
    const { text ,id } = req.body;
    const { file } = req;
    if (!text.trim() || !file) {
        return res.render("home",{
            result:req.session.result,
            user:req.session.user,
            error:"Text and Image are required",
        });
    }

    const result1 = await Todo.create({
        text: text,
        _id: id,
        ImageURL: `/uploads/${file.filename}`,
        createdBy:req.session.user? req.session.user.email : "Guest",
    });
    res.end();
});

app.post("/delete",checkforAuth,async (req, res) => {
    const { id } = req.body;
    console.log("its delete data");
    try {
        const task=await Todo.findByIdAndDelete(id);
        const filePath = path.join(__dirname, 'public', task.ImageURL);
        await fs.unlink(filePath, (err) => {
            if (err) {
                return res.render("home",{
                    result:req.session.result,
                    user:req.session.user,
                    error:"Error while deleting the file",
                });
            } else {
            console.log("File deleted successfully");
            }
        });
        res.end();
    } catch (error) {
        return res.render("home",{
            result:req.session.result,
            user:req.session.user,
            error:"Error while deleting the task",
        });
    }
});


app.post("/update",checkforAuth,async(req,res)=>{
    const { id, text } = req.body;
    console.log("its update data");
    try {
        await Todo.findByIdAndUpdate(id, { text });
        return res.redirect("/");
        // const result=await Todo.find({}).sort({_id:-1});
        // res.render("home",{
        //     result:result,
        //     user:req.session.user,
        // });
    } catch (error) {
        return res.render("home",{
            result:req.session.result,
            user:req.session.user,
            error:"Error while updating the task",
        });
    }
});

app.post("/updatecheck",checkforAuth,async (req,res)=>{
    const { id } = req.body;
    console.log("its updatecheck");
    try {
        const resu=await Todo.find({id:id});
        const isCompleted=!resu.isCompleted;
        await Todo.findByIdAndUpdate(id, { isCompleted:isCompleted });
        return res.redirect("/");
        // const result=await Todo.find({}).sort({_id:-1});
        // res.render("home",{
        //     result:result,
        //     user:req.session.user,
        // });
    } catch (error) {
        return res.render("home",{
            result:req.session.result,
            user:req.session.user,
            error:"Error updating the check",
        });
    }
});

app.get("/signin",async (req,res)=>{
    const id=req.headers.cookie?.split(';')[0]?.split('=')[1];
    const id1=req.headers.cookie?.split(';')[1]?.split('=')[1]
    // console.log(1,req.headers);
    // console.log(id);
    if(sessionIdtoUserMap.has(Number(id))  || sessionIdtoUserMap.has(Number(id1))){
        res.redirect("/");
    }else{
        res.render("signin");
    }
    
});

app.post("/signin",async (req,res)=>{
    const {email,password}=req.body;

    if(!email.trim() || !password.trim()){
        return res.render("signin",{
            result:req.session.result,
            user:req.session.user,
            error:"Username and Password are required",
        });
    }

    const user=await User.findOne({id:email});

    if(!user){
        return res.render("signin",{
            result:req.session.result,
            user:req.session.user,
            error:"Invalid username or please signup",
        });
    }

    if(user.password!==password){
        return res.render("signin",{
            result:req.session.result,
            user:req.session.user,
            error:"Please enter the right password",
        });
    }
    const id=Date.now();
    const obj={
        email:email,
        is_logged_in:true,
        fullname:user.fullname,
    }

    sessionIdtoUserMap.set(id,obj);
    res.cookie("SID",id);
    res.redirect("/");
    // res.render("home",{
    //     user:user,
    // });
});

app.get("/logout",checkforAuth,(req,res)=>{
    const id=req.headers.cookie.split(';')[0].split('=')[1];
    const id1=req.headers.cookie.split(';')[1].split('=')[1];
    
    req.session.destroy(async ()=>{
        if(!sessionIdtoUserMap.has(Number(id)) && !sessionIdtoUserMap.has(Number(id1))){
            return res.redirect("/");
        }
        if(sessionIdtoUserMap.has(Number(id))){
            sessionIdtoUserMap.delete(Number(id));
        }
        if(sessionIdtoUserMap.has(Number(id1))){
            sessionIdtoUserMap.delete(Number(id1));
        }
        
        res.clearCookie("SID");
        res.redirect("/");
    });
});

app.post("/signup",async(req,res)=>{
    const {fullName,email,password}=req.body;
    // console.log(fullName);
    if(!fullName.trim() || !email.trim() || !password.trim()){
        return res.render("signup",{
            result:req.session.result,
            user:req.session.user,
            error:"Fullname,email and Password all are required",
        });;
    }
    try{
        const result =await User.create({
            id:email,
            fullname:fullName,
            password:password,
        });
    }catch(error){
        return res.render("signup",{
            result:req.session.result,
            user:req.session.user,
            error:"Email already regestered, please use new email ",
        });
    }

    res.render("signin");
});

app.get("/signup",(req,res)=>{
    const id=req.headers.cookie?.split(';')[0]?.split('=')[1];
    const id1=req.headers.cookie?.split(';')[1]?.split('=')[1]
    // console.log(1,req.headers);
    // console.log(id);
    if(sessionIdtoUserMap.has(Number(id))  || sessionIdtoUserMap.has(Number(id1))){
        res.redirect("/");
    }else{
        res.render("signup");
    }
})

app.listen(port,()=>{
    console.log("its the server");
});

async function checkforAuth(req,res,next){
    console.log(req.cookies);
    
    // const id=req.headers.cookie?.split(';')[0]?.split('=')[1];
    const id=req.cookies['connect.sid'];
    // const id1=req.headers.cookie?.split(';')[1]?.split('=')[1]
    const id1=req.cookies.SID;
    console.log(sessionIdtoUserMap);
    if(sessionIdtoUserMap.has(Number(id))){
        const ss=sessionIdtoUserMap.get(Number(id));
        req.session.user=ss;
        const result=await Todo.find({createdBy:ss.email}).sort({_id:-1});
        req.session.result=result;
    }else if(sessionIdtoUserMap.has(Number(id1))){
        const ss=sessionIdtoUserMap.get(Number(id1));
        req.session.user=ss;
        const result=await Todo.find({createdBy:ss.email}).sort({_id:-1});
        req.session.result=result;
    }
    else{
        console.log("hii");
        return res.render("home",{
            error:"please login first to create tasks",
        });
    }
    next();
}
