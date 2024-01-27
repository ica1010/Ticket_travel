const LocalStrategy = require("passport-local").Strategy
const bcrypt = require("bcrypt")
const con = require('./connection')

function initialize(passport, getUserByEmail, getUserById) {
    const authenticateUsers = async (email, password, done) => {
        try {
            // Récupérer l'utilisateur par email
            const user = await getUserByEmail(email);
            console.log(email);
            console.log(user);
            // Si l'utilisateur n'existe pas
            if (!user) {
                return done(null, false, { message: "No user found with that email" })
            }

            // Comparer le mot de passe
            const passwordMatch = await bcrypt.compare(password, user.pwd);

            if (passwordMatch) {
                return done(null, user);
            } else {
                return done(null, false, { message: "Password Incorrect" });
            }
        } catch (e) {
            console.error(e);
            return done(e);
        }
    }

    passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUsers))
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        const user = await getUserById(id);
        done(null, user);
    });
}

module.exports = initialize
