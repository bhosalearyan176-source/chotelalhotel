const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("❌ JWT_SECRET is missing from .env");
    process.exit(1);
}

// =====================================================
// DIRECTORIES
// =====================================================

const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(publicDir, "uploads");

fs.mkdirSync(uploadDir, {
    recursive: true
});

// =====================================================
// MIDDLEWARE
// =====================================================

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: {
            policy: "cross-origin"
        }
    })
);

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);

app.use(cookieParser());

// =====================================================
// RATE LIMITING
// =====================================================

const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts. Please try again later."
    }
});

const publicWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
});

// =====================================================
// STATIC WEBSITE
// =====================================================

app.use(express.static(publicDir));

app.use(
    "/uploads",
    express.static(uploadDir)
);

// =====================================================
// MYSQL CONNECTION
// =====================================================

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "chotelal_restaurant",
    port: Number(process.env.DB_PORT || 3306),

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    charset: "utf8mb4"
});

// =====================================================
// HELPERS
// =====================================================

function clean(value, max = 500) {
    return String(value ?? "")
        .trim()
        .slice(0, max);
}

function numberOrNull(value) {
    if (
        value === "" ||
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const number = Number(value);

    if (
        !Number.isFinite(number) ||
        number < 0
    ) {
        return null;
    }

    return number;
}

function validId(value) {
    const id = Number(value);

    return Number.isInteger(id) && id > 0
        ? id
        : null;
}

// =====================================================
// IMAGE UPLOAD
// =====================================================

const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, uploadDir);
    },

    filename: function (req, file, callback) {
        const extension = path
            .extname(file.originalname)
            .toLowerCase();

        const filename =
            Date.now() +
            "-" +
            crypto.randomBytes(8).toString("hex") +
            extension;

        callback(null, filename);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: function (req, file, callback) {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            callback(null, true);
        } else {
            callback(
                new Error(
                    "Only JPG, PNG, WEBP and GIF images are allowed."
                )
            );
        }
    }
});

// =====================================================
// ADMIN AUTHENTICATION
// =====================================================

function createAdminToken(admin) {
    return jwt.sign(
        {
            id: admin.id,
            username: admin.username,
            role: "admin"
        },
        JWT_SECRET,
        {
            expiresIn: "8h"
        }
    );
}

function setAdminCookie(response, token) {
    response.cookie(
        "chotelal_admin",
        token,
        {
            httpOnly: true,
            sameSite: "lax",

            secure:
                process.env.NODE_ENV === "production",

            maxAge: 8 * 60 * 60 * 1000,

            path: "/"
        }
    );
}

function clearAdminCookie(response) {
    response.clearCookie(
        "chotelal_admin",
        {
            httpOnly: true,
            sameSite: "lax",

            secure:
                process.env.NODE_ENV === "production",

            path: "/"
        }
    );
}

function requireAdmin(request, response, next) {
    try {
        const token =
            request.cookies.chotelal_admin;

        if (!token) {
            return response
                .status(401)
                .json({
                    success: false,
                    message: "Admin login required."
                });
        }

        const payload = jwt.verify(
            token,
            JWT_SECRET
        );

        if (payload.role !== "admin") {
            throw new Error("Invalid admin role.");
        }

        request.admin = payload;

        next();
    } catch (error) {
        clearAdminCookie(response);

        return response
            .status(401)
            .json({
                success: false,
                message: "Your admin session has expired."
            });
    }
}

// =====================================================
// DELETE LOCAL UPLOAD
// =====================================================

function deleteLocalUpload(imageUrl) {
    if (
        !imageUrl ||
        typeof imageUrl !== "string" ||
        !imageUrl.startsWith("/uploads/")
    ) {
        return;
    }

    const filename = path.basename(imageUrl);

    const fullPath = path.join(
        uploadDir,
        filename
    );

    const resolvedUploadDir =
        path.resolve(uploadDir);

    const resolvedFile =
        path.resolve(fullPath);

    if (
        resolvedFile.startsWith(
            resolvedUploadDir + path.sep
        ) &&
        fs.existsSync(resolvedFile)
    ) {
        try {
            fs.unlinkSync(resolvedFile);
        } catch (error) {
            console.warn(
                "⚠️ Could not delete image:",
                error.message
            );
        }
    }
}

// =====================================================
// DATABASE SCHEMA
// =====================================================

async function ensureSchema() {

    // =================================================
    // ADMINS
    // =================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admins (
            id INT AUTO_INCREMENT PRIMARY KEY,

            username VARCHAR(80)
                NOT NULL UNIQUE,

            password_hash VARCHAR(255)
                NOT NULL,

            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP

        ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
    `);

    // =================================================
    // REVIEWS
    // =================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,

            name VARCHAR(100)
                NOT NULL,

            rating TINYINT
                NOT NULL,

            review TEXT
                NOT NULL,

            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP

        ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
    `);

    // =================================================
    // FEEDBACK
    // =================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS feedback (
            id INT AUTO_INCREMENT PRIMARY KEY,

            name VARCHAR(100)
                NOT NULL,

            email VARCHAR(190),

            message TEXT
                NOT NULL,

            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP

        ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
    `);

    // =================================================
    // SITE SETTINGS
    // =================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS site_settings (
            id INT PRIMARY KEY,

            restaurant_name VARCHAR(150)
                NOT NULL
                DEFAULT 'Chotelal Hotel',

            tagline VARCHAR(255)
                DEFAULT 'Chinese & North Indian Fast Food',

            phone VARCHAR(40)
                DEFAULT '',

            whatsapp VARCHAR(40)
                DEFAULT '',

            address VARCHAR(500)
                DEFAULT 'Barkat Ali Nagar, Salt Pan Road, Wadala East, Mumbai - 400037',

            opening_hours VARCHAR(150)
                DEFAULT '10:00 AM - 11:30 PM',

            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP

        ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
    `);

    // =================================================
    // IMPORTANT:
    // ALWAYS MAKE SURE ID 1 EXISTS
    // =================================================

    await pool.query(`
        INSERT INTO site_settings
        (
            id,
            restaurant_name,
            tagline,
            phone,
            whatsapp,
            address,
            opening_hours
        )
        VALUES
        (
            1,
            'Chotelal Hotel',
            'Chinese & North Indian Fast Food',
            '',
            '',
            'Barkat Ali Nagar, Salt Pan Road, Wadala East, Mumbai - 400037',
            '10:00 AM - 11:30 PM'
        )
        ON DUPLICATE KEY UPDATE
            id = id
    `);

    // =================================================
    // CREATE FIRST ADMIN
    // =================================================

    const [adminCount] = await pool.query(
        "SELECT COUNT(*) AS total FROM admins"
    );

    if (Number(adminCount[0].total) === 0) {

        const username = clean(
            process.env.ADMIN_USERNAME || "admin",
            80
        );

        const password = String(
            process.env.ADMIN_PASSWORD || ""
        );

        if (!password) {

            console.warn(
                "⚠️ ADMIN_PASSWORD is missing from .env"
            );

            console.warn(
                "⚠️ No default admin account was created."
            );

        } else {

            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );

            await pool.query(
                `
                INSERT INTO admins
                (
                    username,
                    password_hash
                )
                VALUES (?, ?)
                `,
                [
                    username,
                    passwordHash
                ]
            );

            console.log(
                `🔐 Admin created: ${username}`
            );
        }
    }

    console.log(
        "✅ Database schema verified."
    );

    console.log(
        "✅ Site settings row verified."
    );
}

// =====================================================
// PUBLIC MENU
// =====================================================

app.get(
    "/api/menu",
    async function (request, response) {

        try {

            const [rows] =
                await pool.query(`
                    SELECT
                        id,
                        name,
                        category,
                        food_type,
                        half_price,
                        full_price,
                        description,
                        image_url

                    FROM menu_items

                    ORDER BY
                        CASE
                            WHEN food_type = 'VEG'
                            THEN 1

                            WHEN food_type = 'NON-VEG'
                            THEN 2

                            ELSE 3
                        END,

                        category,
                        name
                `);

            response.json({
                success: true,
                count: rows.length,
                menu: rows
            });

        } catch (error) {

            console.error(
                "❌ Menu API error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message: "Unable to load menu."
                });
        }
    }
);

// =====================================================
// PUBLIC REVIEWS
// =====================================================

app.get(
    "/api/reviews",
    async function (request, response) {

        try {

            const [rows] =
                await pool.query(`
                    SELECT
                        id,
                        name,
                        rating,
                        review,
                        created_at

                    FROM reviews

                    ORDER BY created_at DESC

                    LIMIT 30
                `);

            response.json({
                success: true,
                reviews: rows
            });

        } catch (error) {

            console.error(
                "❌ Reviews API error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message: "Unable to load reviews."
                });
        }
    }
);

// =====================================================
// CUSTOMER SUBMIT REVIEW
// =====================================================

app.post(
    "/api/reviews",
    publicWriteLimiter,
    async function (request, response) {

        const name = clean(
            request.body.name,
            100
        );

        const review = clean(
            request.body.review,
            1000
        );

        const rating = Number(
            request.body.rating
        );

        if (
            !name ||
            !review ||
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
        ) {
            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Enter name, rating and review."
                });
        }

        try {

            await pool.query(
                `
                INSERT INTO reviews
                (
                    name,
                    rating,
                    review
                )
                VALUES (?, ?, ?)
                `,
                [
                    name,
                    rating,
                    review
                ]
            );

            response
                .status(201)
                .json({
                    success: true,
                    message:
                        "Thank you for your review!"
                });

        } catch (error) {

            console.error(
                "❌ Review insert error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not submit review."
                });
        }
    }
);

// =====================================================
// CUSTOMER FEEDBACK
// =====================================================

app.post(
    "/api/feedback",
    publicWriteLimiter,
    async function (request, response) {

        const name = clean(
            request.body.name,
            100
        );

        const email = clean(
            request.body.email,
            190
        );

        const message = clean(
            request.body.message,
            1500
        );

        if (!name || !message) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Name and message are required."
                });
        }

        // FIXED EMAIL REGEX
        if (
            email &&
            !/^\S+@\S+\.\S+$/.test(email)
        ) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid email address."
                });
        }

        try {

            await pool.query(
                `
                INSERT INTO feedback
                (
                    name,
                    email,
                    message
                )
                VALUES (?, ?, ?)
                `,
                [
                    name,
                    email || null,
                    message
                ]
            );

            response
                .status(201)
                .json({
                    success: true,
                    message:
                        "Feedback received. Thank you!"
                });

        } catch (error) {

            console.error(
                "❌ Feedback insert error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not submit feedback."
                });
        }
    }
);

// =====================================================
// PUBLIC WEBSITE SETTINGS
// =====================================================

app.get(
    "/api/settings",
    async function (request, response) {

        try {

            // Make sure settings row exists
            await pool.query(`
                INSERT INTO site_settings
                (
                    id,
                    restaurant_name,
                    tagline,
                    phone,
                    whatsapp,
                    address,
                    opening_hours
                )
                VALUES
                (
                    1,
                    'Chotelal Hotel',
                    'Chinese & North Indian Fast Food',
                    '',
                    '',
                    'Barkat Ali Nagar, Salt Pan Road, Wadala East, Mumbai - 400037',
                    '10:00 AM - 11:30 PM'
                )
                ON DUPLICATE KEY UPDATE
                    id = id
            `);

            const [rows] =
                await pool.query(`
                    SELECT
                        restaurant_name,
                        tagline,
                        phone,
                        whatsapp,
                        address,
                        opening_hours

                    FROM site_settings

                    WHERE id = 1

                    LIMIT 1
                `);

            response.set(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, proxy-revalidate"
            );

            response.json({
                success: true,
                settings: rows[0] || {}
            });

        } catch (error) {

            console.error(
                "❌ Settings API error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load settings."
                });
        }
    }
);

// =====================================================
// ADMIN LOGIN
// =====================================================

app.post(
    "/api/admin/login",
    adminLoginLimiter,
    async function (request, response) {

        const username = clean(
            request.body.username,
            80
        );

        const password = String(
            request.body.password || ""
        );

        if (!username || !password) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Username and password are required."
                });
        }

        try {

            const [rows] =
                await pool.query(
                    `
                    SELECT
                        id,
                        username,
                        password_hash

                    FROM admins

                    WHERE username = ?

                    LIMIT 1
                    `,
                    [
                        username
                    ]
                );

            const admin = rows[0];

            if (!admin) {

                return response
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Invalid username or password."
                    });
            }

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    admin.password_hash
                );

            if (!passwordMatch) {

                return response
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Invalid username or password."
                    });
            }

            const token =
                createAdminToken(admin);

            setAdminCookie(
                response,
                token
            );

            response.json({
                success: true,
                admin: {
                    id: admin.id,
                    username: admin.username
                }
            });

        } catch (error) {

            console.error(
                "❌ Admin login error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Login failed."
                });
        }
    }
);

// =====================================================
// ADMIN LOGOUT
// =====================================================

app.post(
    "/api/admin/logout",
    function (request, response) {

        clearAdminCookie(response);

        response.json({
            success: true,
            message:
                "Logged out successfully."
        });
    }
);

// =====================================================
// CHECK ADMIN SESSION
// =====================================================

app.get(
    "/api/admin/me",
    requireAdmin,
    function (request, response) {

        response.json({
            success: true,
            admin: {
                id: request.admin.id,
                username: request.admin.username
            }
        });
    }
);

// =====================================================
// ADMIN DASHBOARD STATS
// =====================================================

app.get(
    "/api/admin/stats",
    requireAdmin,
    async function (request, response) {

        try {

            const [menuRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM menu_items
                `);

            const [vegRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM menu_items
                    WHERE food_type = 'VEG'
                `);

            const [nonVegRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM menu_items
                    WHERE food_type = 'NON-VEG'
                `);

            const [reviewRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM reviews
                `);

            const [feedbackRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM feedback
                `);

            const [categoryRows] =
                await pool.query(`
                    SELECT COUNT(DISTINCT category) AS total
                    FROM menu_items
                `);

            const menuCount =
                Number(menuRows[0].total);

            const vegCount =
                Number(vegRows[0].total);

            const nonVegCount =
                Number(nonVegRows[0].total);

            const reviewCount =
                Number(reviewRows[0].total);

            const feedbackCount =
                Number(feedbackRows[0].total);

            const categoryCount =
                Number(categoryRows[0].total);

            response.json({
                success: true,

                stats: {

                    menu: menuCount,
                    reviews: reviewCount,
                    feedback: feedbackCount,
                    categories: categoryCount,
                    veg: vegCount,
                    nonVeg: nonVegCount,

                    menuCount: menuCount,
                    totalMenu: menuCount,

                    reviewCount: reviewCount,
                    totalReviews: reviewCount,

                    feedbackCount: feedbackCount,
                    totalFeedback: feedbackCount,

                    vegCount: vegCount,
                    totalVeg: vegCount,

                    nonVegCount: nonVegCount,
                    totalNonVeg: nonVegCount
                }
            });

        } catch (error) {

            console.error(
                "❌ Dashboard error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load dashboard."
                });
        }
    }
);

// =====================================================
// ADMIN GET MENU
// =====================================================

app.get(
    "/api/admin/menu",
    requireAdmin,
    async function (request, response) {

        try {

            const [rows] =
                await pool.query(`
                    SELECT
                        id,
                        name,
                        category,
                        food_type,
                        half_price,
                        full_price,
                        description,
                        image_url,
                        created_at

                    FROM menu_items

                    ORDER BY id DESC
                `);

            response.json({
                success: true,
                menu: rows
            });

        } catch (error) {

            console.error(
                "❌ Admin menu error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load admin menu."
                });
        }
    }
);

// =====================================================
// ADMIN ADD FOOD
// =====================================================

app.post(
    "/api/admin/menu",
    requireAdmin,
    upload.single("image"),
    async function (request, response) {

        const name = clean(
            request.body.name,
            150
        );

        const category = clean(
            request.body.category,
            100
        );

        const foodType = clean(
            request.body.food_type,
            20
        ).toUpperCase();

        const description = clean(
            request.body.description,
            1000
        );

        const halfPrice =
            numberOrNull(
                request.body.half_price
            );

        const fullPrice =
            numberOrNull(
                request.body.full_price
            );

        const imageUrl =
            request.file
                ? `/uploads/${request.file.filename}`
                : clean(
                    request.body.image_url,
                    500
                );

        // =================================================
        // VALIDATION
        // =================================================

        if (
            !name ||
            !category ||
            !["VEG", "NON-VEG"].includes(foodType) ||
            (
                halfPrice === null &&
                fullPrice === null
            )
        ) {

            if (
                request.file &&
                fs.existsSync(request.file.path)
            ) {
                fs.unlinkSync(
                    request.file.path
                );
            }

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Name, category, food type and at least one price are required."
                });
        }

        try {

            const [result] =
                await pool.query(
                    `
                    INSERT INTO menu_items
                    (
                        name,
                        category,
                        food_type,
                        half_price,
                        full_price,
                        description,
                        image_url
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        name,
                        category,
                        foodType,
                        halfPrice,
                        fullPrice,
                        description,
                        imageUrl || null
                    ]
                );

            const [rows] =
                await pool.query(
                    `
                    SELECT
                        id,
                        name,
                        category,
                        food_type,
                        half_price,
                        full_price,
                        description,
                        image_url,
                        created_at

                    FROM menu_items

                    WHERE id = ?
                    `,
                    [
                        result.insertId
                    ]
                );

            response
                .status(201)
                .json({
                    success: true,
                    item: rows[0]
                });

        } catch (error) {

            if (
                request.file &&
                fs.existsSync(request.file.path)
            ) {
                fs.unlinkSync(
                    request.file.path
                );
            }

            console.error(
                "❌ Add menu item error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not add food item."
                });
        }
    }
);

// =====================================================
// ADMIN EDIT FOOD
// =====================================================

app.put(
    "/api/admin/menu/:id",
    requireAdmin,
    upload.single("image"),
    async function (request, response) {

        const id =
            validId(request.params.id);

        if (!id) {

            if (
                request.file &&
                fs.existsSync(request.file.path)
            ) {
                fs.unlinkSync(
                    request.file.path
                );
            }

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid menu item ID."
                });
        }

        const name = clean(
            request.body.name,
            150
        );

        const category = clean(
            request.body.category,
            100
        );

        const foodType = clean(
            request.body.food_type,
            20
        ).toUpperCase();

        const description = clean(
            request.body.description,
            1000
        );

        const halfPrice =
            numberOrNull(
                request.body.half_price
            );

        const fullPrice =
            numberOrNull(
                request.body.full_price
            );

        if (
            !name ||
            !category ||
            !["VEG", "NON-VEG"].includes(foodType) ||
            (
                halfPrice === null &&
                fullPrice === null
            )
        ) {

            if (
                request.file &&
                fs.existsSync(request.file.path)
            ) {
                fs.unlinkSync(
                    request.file.path
                );
            }

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid menu data."
                });
        }

        try {

            const [oldRows] =
                await pool.query(
                    `
                    SELECT *
                    FROM menu_items
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            const old = oldRows[0];

            if (!old) {

                if (
                    request.file &&
                    fs.existsSync(request.file.path)
                ) {
                    fs.unlinkSync(
                        request.file.path
                    );
                }

                return response
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Food item not found."
                    });
            }

            let imageUrl =
                clean(
                    request.body.image_url,
                    500
                ) ||
                old.image_url ||
                null;

            let oldImageToDelete = null;

            if (request.file) {

                imageUrl =
                    `/uploads/${request.file.filename}`;

                oldImageToDelete =
                    old.image_url;
            }

            await pool.query(
                `
                UPDATE menu_items

                SET
                    name = ?,
                    category = ?,
                    food_type = ?,
                    half_price = ?,
                    full_price = ?,
                    description = ?,
                    image_url = ?

                WHERE id = ?
                `,
                [
                    name,
                    category,
                    foodType,
                    halfPrice,
                    fullPrice,
                    description,
                    imageUrl,
                    id
                ]
            );

            // Delete old image only after
            // successful database update.

            if (oldImageToDelete) {
                deleteLocalUpload(
                    oldImageToDelete
                );
            }

            const [rows] =
                await pool.query(
                    `
                    SELECT
                        id,
                        name,
                        category,
                        food_type,
                        half_price,
                        full_price,
                        description,
                        image_url,
                        created_at

                    FROM menu_items

                    WHERE id = ?
                    `,
                    [
                        id
                    ]
                );

            response.json({
                success: true,
                item: rows[0]
            });

        } catch (error) {

            if (
                request.file &&
                fs.existsSync(request.file.path)
            ) {
                fs.unlinkSync(
                    request.file.path
                );
            }

            console.error(
                "❌ Update menu item error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not update food item."
                });
        }
    }
);

// =====================================================
// ADMIN DELETE FOOD
// =====================================================

app.delete(
    "/api/admin/menu/:id",
    requireAdmin,
    async function (request, response) {

        const id =
            validId(request.params.id);

        if (!id) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid menu item ID."
                });
        }

        try {

            const [rows] =
                await pool.query(
                    `
                    SELECT image_url

                    FROM menu_items

                    WHERE id = ?

                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            const item = rows[0];

            if (!item) {

                return response
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Food item not found."
                    });
            }

            const [result] =
                await pool.query(
                    `
                    DELETE FROM menu_items
                    WHERE id = ?
                    `,
                    [
                        id
                    ]
                );

            if (result.affectedRows === 0) {

                return response
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Food item not found."
                    });
            }

            deleteLocalUpload(
                item.image_url
            );

            response.json({
                success: true,
                message:
                    "Food item deleted."
            });

        } catch (error) {

            console.error(
                "❌ Delete menu item error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not delete food item."
                });
        }
    }
);

// =====================================================
// ADMIN GET REVIEWS
// =====================================================

app.get(
    "/api/admin/reviews",
    requireAdmin,
    async function (request, response) {

        try {

            const [rows] =
                await pool.query(`
                    SELECT
                        id,
                        name,
                        rating,
                        review,
                        created_at

                    FROM reviews

                    ORDER BY created_at DESC
                `);

            response.json({
                success: true,
                reviews: rows
            });

        } catch (error) {

            console.error(
                "❌ Admin reviews error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load reviews."
                });
        }
    }
);

// =====================================================
// ADMIN DELETE REVIEW
// =====================================================

app.delete(
    "/api/admin/reviews/:id",
    requireAdmin,
    async function (request, response) {

        const id =
            validId(request.params.id);

        if (!id) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid review ID."
                });
        }

        try {

            const [result] =
                await pool.query(
                    `
                    DELETE FROM reviews
                    WHERE id = ?
                    `,
                    [
                        id
                    ]
                );

            if (
                result.affectedRows === 0
            ) {

                return response
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Review not found."
                    });
            }

            response.json({
                success: true,
                message:
                    "Review deleted."
            });

        } catch (error) {

            console.error(
                "❌ Delete review error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not delete review."
                });
        }
    }
);

// =====================================================
// ADMIN GET FEEDBACK
// =====================================================

app.get(
    "/api/admin/feedback",
    requireAdmin,
    async function (request, response) {

        try {

            const [rows] =
                await pool.query(`
                    SELECT
                        id,
                        name,
                        email,
                        message,
                        created_at

                    FROM feedback

                    ORDER BY created_at DESC
                `);

            response.json({
                success: true,
                feedback: rows
            });

        } catch (error) {

            console.error(
                "❌ Admin feedback error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load feedback."
                });
        }
    }
);

// =====================================================
// ADMIN DELETE FEEDBACK
// =====================================================

app.delete(
    "/api/admin/feedback/:id",
    requireAdmin,
    async function (request, response) {

        const id =
            validId(request.params.id);

        if (!id) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid feedback ID."
                });
        }

        try {

            const [result] =
                await pool.query(
                    `
                    DELETE FROM feedback
                    WHERE id = ?
                    `,
                    [
                        id
                    ]
                );

            if (
                result.affectedRows === 0
            ) {

                return response
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Feedback not found."
                    });
            }

            response.json({
                success: true,
                message:
                    "Feedback deleted."
            });

        } catch (error) {

            console.error(
                "❌ Delete feedback error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not delete feedback."
                });
        }
    }
);

// =====================================================
// ADMIN WEBSITE SETTINGS - GET
// =====================================================

app.get(
    "/api/admin/settings",
    requireAdmin,
    async function (request, response) {

        try {

            // IMPORTANT FIX:
            // Make sure row ID 1 exists before SELECT.

            await pool.query(`
                INSERT INTO site_settings
                (
                    id,
                    restaurant_name,
                    tagline,
                    phone,
                    whatsapp,
                    address,
                    opening_hours
                )
                VALUES
                (
                    1,
                    'Chotelal Hotel',
                    'Chinese & North Indian Fast Food',
                    '',
                    '',
                    'Barkat Ali Nagar, Salt Pan Road, Wadala East, Mumbai - 400037',
                    '10:00 AM - 11:30 PM'
                )
                ON DUPLICATE KEY UPDATE
                    id = id
            `);

            const [rows] =
                await pool.query(`
                    SELECT
                        id,
                        restaurant_name,
                        tagline,
                        phone,
                        whatsapp,
                        address,
                        opening_hours,
                        updated_at

                    FROM site_settings

                    WHERE id = 1

                    LIMIT 1
                `);

            response.set(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, proxy-revalidate"
            );

            response.json({
                success: true,
                settings: rows[0] || {}
            });

        } catch (error) {

            console.error(
                "❌ Admin settings GET error:",
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load settings."
                });
        }
    }
);

// =====================================================
// ADMIN WEBSITE SETTINGS - UPDATE
// =====================================================

app.put(
    "/api/admin/settings",
    requireAdmin,
    async function (request, response) {

        // =================================================
        // READ + CLEAN VALUES
        // =================================================

        const restaurantName =
            clean(
                request.body.restaurant_name,
                150
            ) || "Chotelal Hotel";

        const tagline =
            clean(
                request.body.tagline,
                255
            );

        const phone =
            clean(
                request.body.phone,
                40
            );

        const whatsapp =
            clean(
                request.body.whatsapp,
                40
            );

        const address =
            clean(
                request.body.address,
                500
            );

        const openingHours =
            clean(
                request.body.opening_hours,
                150
            );

        // =================================================
        // VALIDATION
        // =================================================

        if (!restaurantName) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Restaurant name is required."
                });
        }

        try {

            // =================================================
            // IMPORTANT FIX:
            // CREATE/REPAIR SETTINGS ROW BEFORE UPDATE
            // =================================================

            await pool.query(`
                INSERT INTO site_settings
                (
                    id,
                    restaurant_name,
                    tagline,
                    phone,
                    whatsapp,
                    address,
                    opening_hours
                )
                VALUES
                (
                    1,
                    'Chotelal Hotel',
                    'Chinese & North Indian Fast Food',
                    '',
                    '',
                    'Barkat Ali Nagar, Salt Pan Road, Wadala East, Mumbai - 400037',
                    '10:00 AM - 11:30 PM'
                )
                ON DUPLICATE KEY UPDATE
                    id = id
            `);

            // =================================================
            // UPDATE SETTINGS
            // =================================================

            const [result] =
                await pool.query(
                    `
                    UPDATE site_settings

                    SET
                        restaurant_name = ?,
                        tagline = ?,
                        phone = ?,
                        whatsapp = ?,
                        address = ?,
                        opening_hours = ?

                    WHERE id = 1
                    `,
                    [
                        restaurantName,
                        tagline,
                        phone,
                        whatsapp,
                        address,
                        openingHours
                    ]
                );

            // =================================================
            // VERIFY UPDATE
            // =================================================

            if (
                result.affectedRows === 0
            ) {

                console.error(
                    "❌ Settings UPDATE affected 0 rows."
                );

                return response
                    .status(500)
                    .json({
                        success: false,
                        message:
                            "Website settings could not be saved."
                    });
            }

            // =================================================
            // READ BACK SAVED DATA
            // =================================================

            const [rows] =
                await pool.query(`
                    SELECT
                        id,
                        restaurant_name,
                        tagline,
                        phone,
                        whatsapp,
                        address,
                        opening_hours,
                        updated_at

                    FROM site_settings

                    WHERE id = 1

                    LIMIT 1
                `);

            console.log("");
            console.log(
                "===================================="
            );
            console.log(
                "✅ WEBSITE SETTINGS UPDATED"
            );
            console.log(
                "===================================="
            );
            console.log(
                "Restaurant:",
                restaurantName
            );
            console.log(
                "Tagline:",
                tagline
            );
            console.log(
                "Phone:",
                phone
            );
            console.log(
                "WhatsApp:",
                whatsapp
            );
            console.log(
                "Address:",
                address
            );
            console.log(
                "Hours:",
                openingHours
            );
            console.log(
                "===================================="
            );
            console.log("");

            response.set(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, proxy-revalidate"
            );

            response.json({
                success: true,

                message:
                    "Website information updated successfully.",

                settings:
                    rows[0] || {}
            });

        } catch (error) {

            console.error(
                "❌ Update settings error:"
            );

            console.error(
                error
            );

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not update settings."
                });
        }
    }
);

// =====================================================
// CHANGE ADMIN USERNAME + PASSWORD
// =====================================================

app.put(
    "/api/admin/account",
    requireAdmin,
    async function (request, response) {

        const username =
            clean(
                request.body.username,
                80
            );

        const currentPassword =
            String(
                request.body.current_password || ""
            );

        const newPassword =
            String(
                request.body.new_password || ""
            );

        if (!username) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Username is required."
                });
        }

        if (newPassword.length < 8) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "New password must be at least 8 characters."
                });
        }

        if (!currentPassword) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        "Current password is required."
                });
        }

        try {

            const [rows] =
                await pool.query(
                    `
                    SELECT
                        id,
                        username,
                        password_hash

                    FROM admins

                    WHERE id = ?

                    LIMIT 1
                    `,
                    [
                        request.admin.id
                    ]
                );

            const admin = rows[0];

            if (!admin) {

                return response
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Admin account not found."
                    });
            }

            const passwordMatch =
                await bcrypt.compare(
                    currentPassword,
                    admin.password_hash
                );

            if (!passwordMatch) {

                return response
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Current password is incorrect."
                    });
            }

            const hash =
                await bcrypt.hash(
                    newPassword,
                    12
                );

            await pool.query(
                `
                UPDATE admins

                SET
                    username = ?,
                    password_hash = ?

                WHERE id = ?
                `,
                [
                    username,
                    hash,
                    admin.id
                ]
            );

            clearAdminCookie(response);

            response.json({
                success: true,
                message:
                    "Admin account updated. Please login again."
            });

        } catch (error) {

            console.error(
                "❌ Update admin account error:",
                error
            );

            if (
                error.code === "ER_DUP_ENTRY"
            ) {

                return response
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "That username already exists."
                    });
            }

            response
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not update admin account."
                });
        }
    }
);

// =====================================================
// ADMIN PAGE
// =====================================================

app.get(
    "/admin",
    function (request, response) {

        response.sendFile(
            path.join(
                publicDir,
                "admin.html"
            )
        );
    }
);

app.get(
    "/admin.html",
    function (request, response) {

        response.sendFile(
            path.join(
                publicDir,
                "admin.html"
            )
        );
    }
);

app.get(
    "/admin/login",
    function (request, response) {

        response.sendFile(
            path.join(
                publicDir,
                "admin.html"
            )
        );
    }
);

// =====================================================
// 404 API HANDLER
// =====================================================

app.use(
    "/api",
    function (request, response) {

        response
            .status(404)
            .json({
                success: false,
                message:
                    "API endpoint not found."
            });
    }
);

// =====================================================
// MULTER / GENERAL ERROR HANDLER
// =====================================================

app.use(
    function (
        error,
        request,
        response,
        next
    ) {

        console.error(
            "❌ Server error:",
            error
        );

        if (
            error instanceof
            multer.MulterError
        ) {

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                return response
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Image must be smaller than 5MB."
                    });
            }

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }

        if (
            error &&
            error.message &&
            error.message.includes(
                "Only JPG"
            )
        ) {

            return response
                .status(400)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }

        response
            .status(500)
            .json({
                success: false,
                message:
                    "Something went wrong on the server."
            });
    }
);

// =====================================================
// START SERVER
// =====================================================

async function startServer() {

    try {

        // Check database
        await pool.query("SELECT 1");

        // Create/verify tables
        await ensureSchema();

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "✅ MySQL connected successfully!"
        );

        console.log(
            "🍽️ Chotelal Hotel database ready."
        );

        console.log(
            "===================================="
        );

        app.listen(
            PORT,
            function () {

                console.log("");

                console.log(
                    "===================================="
                );

                console.log(
                    "🍽️ CHOTELAL HOTEL"
                );

                console.log(
                    "===================================="
                );

                console.log(
                    `🌐 Website: http://localhost:${PORT}`
                );

                console.log(
                    `📋 Menu: http://localhost:${PORT}/menu.html`
                );

                console.log(
                    `🔐 Admin: http://localhost:${PORT}/admin`
                );

                console.log(
                    `⚙️ Settings API: http://localhost:${PORT}/api/settings`
                );

                console.log(
                    "===================================="
                );

                console.log(
                    "🚀 Server is running successfully!"
                );

                console.log("");
            }
        );

    } catch (error) {

        console.error("");

        console.error(
            "❌ SERVER STARTUP FAILED"
        );

        console.error(
            "===================================="
        );

        console.error(
            error.message
        );

        console.error(
            "===================================="
        );

        process.exit(1);
    }
}

startServer();