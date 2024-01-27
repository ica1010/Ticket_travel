const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const passport = require("passport");
const initializePassport = require("./passport-config");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const mysql = require("mysql2/promise");




if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

// Utilisation de pool pour la connexion à la base de données
const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "ticket_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Fonction utilitaire pour exécuter une requête SQL
async function executeQuery(sql, values) {
    const connection = await pool.getConnection();
    try {
        const [result] = await connection.query(sql, values);
        return result;
    } finally {
        connection.release();
    }
}

initializePassport(
    passport,

    async (email) => {
        const sql = "SELECT * FROM users WHERE email = ?";
        const [user] = await executeQuery(sql, [email]);
        return user;
    },

    async (id) => {
        const sql = "SELECT * FROM users WHERE id = ?";
        const [user] = await executeQuery(sql, [id]);
        return user;
    }
);

app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
    session({
        secret: 'secret',
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

const tickets = [];
// Routes

app.post("/sign-in", checkNotAuthenticated, passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/sign-in",
    failureFlash: true
}));

app.post("/sign-up", checkNotAuthenticated, async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.pwd, 10);
        const id = Date.now().toString();
        const sql =
            "INSERT INTO users (id ,first_name , last_name, email, phone,statut, pwd) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const values = [
            id,
            req.body.first_name,
            req.body.last_name,
            req.body.email,
            req.body.phone,
            'false',
            hashedPassword,
        ];
        await executeQuery(sql, values);
        res.redirect("/sign-in");
    } catch (e) {
        console.error(e);
        res.redirect("/sign-up");
    }
});

app.post("/reserved", async (req, res) => {
    try {
        // const Cate = Date.now;
        const id = Date.now().toString();
        const sql =
            "INSERT INTO reserver (id ,users , ticket) VALUES (?, ?, ?)";
        const values = [
            id,
            req.user.id,
            req.body.ticket_id,
            // date
        ];
        await executeQuery(sql, values);
        res.redirect("/");
    } catch (e) {
        console.error(e);
        res.redirect("/");
    }
});

app.post("/", checkAuthenticated, async (req, res) => {
    try {
        const id = Date.now().toString();
        const sql =
            "INSERT INTO ticket (id , departure , arrival , type , price , date_v , time_v ) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const values = [
            id,
            req.body.departure,
            req.body.arrival,
            req.body.type,
            req.body.price,
            req.body.date_v,
            req.body.time_v,
        ];
        await executeQuery(sql, values);
        res.redirect("/");
    } catch (e) {
        console.error(e);
        res.redirect("/");
    }
});

app.get('/sign-in', checkNotAuthenticated, (req, res) => {
    res.render('sign_in.ejs');
});

app.get('/sign-up', checkNotAuthenticated, (req, res) => {
    res.render('sign_up.ejs');
});

app.get('/', checkAuthenticated, async (req, res) => {

    try {
        const { searchResults } = req.session;
        const connection = await pool.getConnection();
        const [ticket, fields] = await connection.execute('SELECT * FROM ticket');
        const [reserved, fields2] = await connection.execute(
            'SELECT * FROM  reserver WHERE users = ?',
            [req.user.id]
        );
        const [ticket_r, fields3] = await connection.execute('SELECT DISTINCT ticket.* FROM reserver JOIN ticket ON reserver.ticket = ticket.id WHERE reserver.users = ?',[req.user.id] );
        console.log('ccccccccccccccccccccc',ticket_r);
        connection.release();
        if (searchResults) {
            // Afficher les résultats sur la page
            res.render('profile.ejs', {user: req.user, ticket: ticket, tickets: searchResults.tickets, departure: searchResults.departure, arrival: searchResults.arrival, type: searchResults.type, reserved:reserved, ticket_r:ticket_r });

            // Effacer les données de la session après les avoir affichées (si nécessaire)
            delete req.session.searchResults;
        } else {
            // Gérer le cas où il n'y a pas de résultats de recherche
            res.render('profile.ejs', {user: req.user, ticket: ticket, tickets: [], departure: null, arrival: null, type: null ,reserved:reserved , ticket_r:ticket_r});
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Erreur serveur');
    }
});

app.get('/search', async (req, res) => {
    try {
        const { departure, arrival, type } = req.query;
        const connection = await pool.getConnection();
        const [tickets, fields] = await connection.execute(
            'SELECT * FROM ticket WHERE departure = ? OR arrival = ? AND type = ?',
            [departure, arrival, type]
        );
        console.log('ccccccccccccccccccccccc', tickets);
        connection.release();

        // Stocker les données dans une session
        req.session.searchResults = { tickets, departure, arrival, type };

        // Rediriger vers /
        res.redirect('/' );
    } catch (error) {
        console.error(error);
        res.status(500).send('Erreur serveur');
    }
});



  

app.delete("/sign-out", (req, res) => {
    req.logout(req.user, err => {
        if (err) return next(err);
        res.redirect("/");
    });
});

// Middleware

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/sign-in");
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    next();
}

// Server

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
