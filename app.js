//jshint esversion:6
import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";

// import new packages to use cookies and sessions
import session from "express-session";
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";

// setting up server
const app = express();
const port = 3000;

// middleware
app.use(express.static("public"));
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// set up session (express-session). Refere to the doc to understand the options
app.use(
  session({
    secret: "Our little secret",
    resave: false,
    saveUninitialized: false,
  })
);

// initialize passport. Esta parte está especiicada en la documentación de passport:
app.use(passport.initialize());
app.use(passport.session());

// database url
const dbUrl = "mongodb://localhost:27017/newUserDB";

// connecting to the database and if succeded, connect to the server
main()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => console.log(err));

async function main() {
  await mongoose.connect(dbUrl);
}

// create a new mongoose schema for the data to be store
const credentialSchema = new mongoose.Schema({
  username: String,
  password: String,
});

// here we use a plugin to our mongoose schema to enable passport.
// passport-local-mongoose allows us to hash and salt (like using bcrypt) and save to the mongodb database
credentialSchema.plugin(passportLocalMongoose);

// compiling the schema into a mongoose Model
const Credential = mongoose.model("Credential", credentialSchema);

// once model the schema, we can set up the configuration of passport-local
passport.use(Credential.createStrategy());

passport.serializeUser(Credential.serializeUser());
passport.deserializeUser(Credential.deserializeUser());

// express methods
app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/secrets", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("secrets.ejs");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  // use passport to logout. delete the cookie created and terminate the session
  req.logout((err) => {
    if (err) {
      console.log(err);
    }
  });
  res.redirect("/");
});

app.post("/register", (req, res) => {
  // use passport-local mongoose to register the user
  Credential.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.post("/login", (req, res) => {
  // first we need to create a new object with the credentials using the mongoose scheme
  const user = new Credential({
    username: req.body.username,
    password: req.body.password,
  });
  // use passport and login() function to authentica the user in the database and grant access
  req.logIn(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});
