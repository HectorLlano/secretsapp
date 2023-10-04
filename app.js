//jshint esversion:6
import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";

// import new packages to use cookies and sessions
import session from "express-session";
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";

// google oauth
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import findOrCreate from "mongoose-findorcreate";

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
  googleId: String,
  secret: String,
});

// here we use a plugin to our mongoose schema to enable passport.
// passport-local-mongoose allows us to hash and salt (like using bcrypt) and save to the mongodb database
credentialSchema.plugin(passportLocalMongoose);

// add another plugin to be able to use findOrCreate later on
credentialSchema.plugin(findOrCreate);

// compiling the schema into a mongoose Model
const Credential = mongoose.model("Credential", credentialSchema);

// once model the schema, we can set up the configuration of passport-local
passport.use(Credential.createStrategy());

// passport.serializeUser(Credential.serializeUser());
// passport.deserializeUser(Credential.deserializeUser());
passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture,
    });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

// configure strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      Credential.findOrCreate(
        {
          googleId: profile.id,
        },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

// routs methods
app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  }
);

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/secrets", (req, res) => {
  Credential.find({ secret: { $ne: null } })
    .then((foundUsers) => {
      res.render("secrets.ejs", { usersWithSecrets: foundUsers });
    })
    .catch((err) => {
      console.log(err);
    });
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

app.get("/submit", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit.ejs");
  } else {
    res.redirect("/login");
  }
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

app.post("/submit", async (req, res) => {
  try {
    const newSecret = req.body.secret;
    const foundUser = await Credential.findById(req.user.id);

    if (foundUser) {
      foundUser.secret = newSecret;
      await foundUser.save();
      res.redirect("/secrets");
    }
  } catch (err) {
    console.log(err);
  }
});
