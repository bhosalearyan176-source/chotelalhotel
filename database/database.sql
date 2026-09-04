CREATE DATABASE chotelal_restaurant
DEFAULT CHARACTER SET = 'utf8mb4';

USE chotelal_restaurant;

CREATE TABLE menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    food_type ENUM('VEG', 'NON-VEG') NOT NULL,
    half_price DECIMAL(10,2) NULL,
    full_price DECIMAL(10,2) NULL,
    description TEXT,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DESCRIBE menu_items;

USE chotelal_restaurant;

INSERT INTO menu_items
(name, category, food_type, half_price, full_price)
VALUES
('Veg Manchurian Rice', 'Rice With Gravy', 'VEG', 130, 260),
('Veg Chilly Rice', 'Rice With Gravy', 'VEG', 140, 280),
('Veg Schezwan Triple Rice', 'Rice With Gravy', 'VEG', 140, 280),
('Veg Manchow Soup', 'Veg Soup', 'VEG', 60, 120),
('Chicken Manchow Soup', 'Non-Veg Soup', 'NON-VEG', 70, 140);

USE chotelal_restaurant;

SELECT * FROM menu_items;

USE chotelal_restaurant;

INSERT INTO menu_items
(name, category, food_type, half_price, full_price)
VALUES

('Veg Sherpa Rice', 'Rice With Gravy', 'VEG', 140, 280),
('Veg Dragon Rice', 'Rice With Gravy', 'VEG', 140, 280),
('Veg Chopper Rice', 'Rice With Gravy', 'VEG', 160, 320),
('Veg Hunan Rice', 'Rice With Gravy', 'VEG', 140, 280),
('Veg Thousand Rice', 'Rice With Gravy', 'VEG', NULL, 340),
('Veg Paneer Triple', 'Rice With Gravy', 'VEG', 160, 320),
('Veg Paneer Chilly', 'Rice With Gravy', 'VEG', 160, 320),
('Veg Mushroom Chilly Rice', 'Rice With Gravy', 'VEG', 150, 300),
('Veg Mushroom Triple Rice', 'Rice With Gravy', 'VEG', 150, 300),

('Veg Manchurian Noodles', 'Noodles With Gravy', 'VEG', 130, 260),
('Veg Chilly Noodles', 'Noodles With Gravy', 'VEG', 140, 280),
('Veg Sherpa Noodles', 'Noodles With Gravy', 'VEG', 140, 280),
('Veg Dragon Noodles', 'Noodles With Gravy', 'VEG', 140, 280),
('Veg Chopper Noodles', 'Noodles With Gravy', 'VEG', 160, 320),
('Veg Hunan Noodles', 'Noodles With Gravy', 'VEG', 140, 280),
('Veg Thousand Noodles', 'Noodles With Gravy', 'VEG', NULL, 340),
('Veg Paneer Triple Noodles', 'Noodles With Gravy', 'VEG', 160, 320),
('Veg Paneer Chilly Noodles', 'Noodles With Gravy', 'VEG', 160, 320),
('Veg Mushroom Chilly Noodles', 'Noodles With Gravy', 'VEG', 150, 300),
('Veg Mushroom Triple Noodles', 'Noodles With Gravy', 'VEG', 150, 300),
('Veg Schezwan Triple Noodles', 'Noodles With Gravy', 'VEG', 140, 280),

('Veg Manchurian Soup', 'Veg Soup', 'VEG', 70, 140),
('Veg Hot & Sour Soup', 'Veg Soup', 'VEG', 70, 140),
('Veg Noodles Soup', 'Veg Soup', 'VEG', 70, 140),
('Veg Royal Soup', 'Veg Soup', 'VEG', 80, 160),
('Veg Clear Soup', 'Veg Soup', 'VEG', 100, 150),
('Veg Garlic Soup', 'Veg Soup', 'VEG', 80, 160),
('Veg Ginger Soup', 'Veg Soup', 'VEG', 80, 160),
('Veg Lemon Coriander Soup', 'Veg Soup', 'VEG', 80, 150),

('Paneer 99', 'Veg Starter', 'VEG', 160, 320),
('Paneer Chilly Dry', 'Veg Starter', 'VEG', 150, 300),
('Paneer 65', 'Veg Starter', 'VEG', 150, 300),
('Paneer Peri-Peri Sauce', 'Veg Starter', 'VEG', 150, 300),
('Paneer Pakoda', 'Veg Starter', 'VEG', 150, 300),
('Paneer Crispy', 'Veg Starter', 'VEG', 150, 300),
('Veg Crispy', 'Veg Starter', 'VEG', NULL, 220),
('Veg Manchurian Dry', 'Veg Starter', 'VEG', 110, 220),
('Veg Chinese Bhel', 'Veg Starter', 'VEG', 100, 200),
('Veg Mushroom Chilly Dry', 'Veg Starter', 'VEG', 120, 240),
('Veg Mushroom Chilly Gravy', 'Veg Starter', 'VEG', 120, 240),
('Veg Chilly Gravy', 'Veg Starter', 'VEG', 140, 280),
('Paneer Chilly Gravy', 'Veg Starter', 'VEG', 140, 280),
('Potato Chilli Dry', 'Veg Starter', 'VEG', NULL, 150),
('French Fries', 'Veg Starter', 'VEG', NULL, 150),

('Chicken Schezwan Triple Rice', 'Rice With Gravy', 'NON-VEG', 150, 300),
('Chicken Manchurian Rice', 'Rice With Gravy', 'NON-VEG', 140, 280),
('Chicken Chilly Rice', 'Rice With Gravy', 'NON-VEG', 150, 300),
('Chicken Sherpa Rice', 'Rice With Gravy', 'NON-VEG', 150, 300),
('Chicken Dragon Rice', 'Rice With Gravy', 'NON-VEG', 150, 300),
('Chicken Chopper Rice', 'Rice With Gravy', 'NON-VEG', 170, 340),
('Chicken Hunan Rice', 'Rice With Gravy', 'NON-VEG', 150, 300),
('Chicken Thousand Rice', 'Rice With Gravy', 'NON-VEG', NULL, 370),
('Chicken Malaysian Triple', 'Rice With Gravy', 'NON-VEG', NULL, 370),

('Chicken Schezwan Triple Noodles', 'Noodles With Gravy', 'NON-VEG', 150, 300),
('Chicken Manchurian Noodles', 'Noodles With Gravy', 'NON-VEG', 140, 280),
('Chicken Chilly Noodles', 'Noodles With Gravy', 'NON-VEG', 150, 300),
('Chicken Sherpa Noodles', 'Noodles With Gravy', 'NON-VEG', 150, 300),
('Chicken Dragon Noodles', 'Noodles With Gravy', 'NON-VEG', 150, 300),
('Chicken Chopper Noodles', 'Noodles With Gravy', 'NON-VEG', 170, 340),
('Chicken Hunan Noodles', 'Noodles With Gravy', 'NON-VEG', 150, 300),
('Chicken Thousand Noodles', 'Noodles With Gravy', 'NON-VEG', NULL, 370),
('Chicken Malaysian Noodles', 'Noodles With Gravy', 'NON-VEG', NULL, 370),

('Chicken Manchow Soup', 'Non-Veg Soup', 'NON-VEG', 70, 140),
('Chicken Manchurian Soup', 'Non-Veg Soup', 'NON-VEG', 80, 160),
('Chicken Hot & Sour Soup', 'Non-Veg Soup', 'NON-VEG', 80, 160),
('Chicken Noodles Soup', 'Non-Veg Soup', 'NON-VEG', 80, 160),
('Chicken Royal Soup', 'Non-Veg Soup', 'NON-VEG', 90, 180),
('Chicken Clear Soup', 'Non-Veg Soup', 'NON-VEG', 100, 200),
('Chicken Garlic Soup', 'Non-Veg Soup', 'NON-VEG', 90, 180),
('Chicken Ginger Soup', 'Non-Veg Soup', 'NON-VEG', 90, 180),
('Chicken Lung Fung Soup', 'Non-Veg Soup', 'NON-VEG', NULL, 200),
('Chicken Lemon Coriander Soup', 'Non-Veg Soup', 'NON-VEG', NULL, 200),

('Chicken Pakoda With (5 Pc)', 'Non-Veg Starter', 'NON-VEG', 110, 220),
('Chicken Pakoda Boneless (5 Pc)', 'Non-Veg Starter', 'NON-VEG', 110, 220),
('Chicken 99', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken 65', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Crispy', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Hot Garlic', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Red Hot Sauce', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Manchurian Dry', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Peri-Peri Sauce', 'Non-Veg Starter', 'NON-VEG', NULL, 300),
('Chicken Chilly Dry', 'Non-Veg Starter', 'NON-VEG', 120, 240),
('Chicken Chilly Singapore', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Chilly Hong Kong Sauce', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Chilly Bhel', 'Non-Veg Starter', 'NON-VEG', 110, 220),
('Chicken Chilly Gravy', 'Non-Veg Starter', 'NON-VEG', 120, 240),
('Chicken Manchurian Gravy', 'Non-Veg Starter', 'NON-VEG', 120, 240),
('Chicken Lolly Pop Masala Dry', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Lolly Pop Singapore Dry', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Lolly Pop Hong Kong Sauce', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Lolly Pop Oil Dry', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Lolly Pop Apple Fry', 'Non-Veg Starter', 'NON-VEG', 150, 300),
('Chicken Lolly Pop Gravy', 'Non-Veg Starter', 'NON-VEG', 140, 280);

USE chotelal_restaurant;

SELECT COUNT(*) AS total_menu_items
FROM menu_items;

show tables;

USE chotelal_restaurant;
UPDATE menu_items
SET image_url = '/images/menu/vegpaneerchillynoodles.jpg'
WHERE name = 'Veg Paneer Chilly Noodles';

SELECT id, name, image_url
FROM menu_items
WHERE name LIKE '%Veg Paneer Chilly Noodles%';