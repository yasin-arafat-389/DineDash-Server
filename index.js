const express = require("express");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const SSLCommerzPayment = require("sslcommerz-lts");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5001;

// Middlewares
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  cors({
    origin: ["http://localhost:5173", "https://dine-dash-client.web.app"],
    credentials: true,
  })
);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { sendInvoice } = require("./Utility/SendInvoice/SendInvoice");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gef2z8f.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false;

async function run() {
  const addressCollection = client.db("DineDash").collection("addresses");
  const providersCollection = client.db("DineDash").collection("providers");
  const restaurantsCollection = client.db("DineDash").collection("restaurants");
  const foodsCollection = client.db("DineDash").collection("foods");
  const ordersCollection = client.db("DineDash").collection("orders");

  try {
    // Get Provider names and images API
    app.get("/providers", async (req, res) => {
      const result = await providersCollection.find().toArray();
      res.send(result);
    });

    // Get Restaurents for homepage slider API
    app.get("/restaurants", async (req, res) => {
      const result = await restaurantsCollection.find().toArray();
      res.send(result);
    });

    // Get single restaurant data
    app.get("/restaurantData", async (req, res) => {
      let name = req.query.name;
      let query = { pathname: name };
      const result = await restaurantsCollection.findOne(query);
      res.send(result);
    });

    // Get all food from foods collection
    app.get("/foods", async (req, res) => {
      const result = await foodsCollection.find().toArray();
      res.send(result);
    });

    // Get calculated food counts for pagination
    app.get("/foods/pagination", async (req, res) => {
      const query = req.query;
      const page = query.page;

      const pageNumber = parseInt(page);
      const perPage = 6;
      const skip = pageNumber * perPage;

      let foods = foodsCollection.find().skip(skip).limit(perPage);
      let result = await foods.toArray();
      let foodCounts = await foodsCollection.countDocuments();

      res.json({ result, foodCounts });
    });

    // Get foods for browse by category
    app.get("/foods/category", async (req, res) => {
      const category = req.query.category;
      let foods = foodsCollection.find({ category: category });
      let result = await foods.toArray();
      res.send(result);
    });

    // Get foods for search result
    app.get("/foods/search", async (req, res) => {
      const search = req.query.search;
      let query = {
        name: { $regex: search, $options: "i" },
      };
      let result = await foodsCollection.find(query).toArray();

      let noResultFound;
      if (result.length === 0) {
        noResultFound = "no result found";
      }

      res.json({ result, noResultFound });
    });

    // Get all restaurant specific food query by name
    app.get("/restaurant", async (req, res) => {
      const name = req.query.name;
      const foods = await foodsCollection.find({ restaurant: name }).toArray();
      res.status(200).json(foods);
    });

    // Insert order data to the orders collection and send email invoice (Cash On Delivery)
    app.post("/orders", async (req, res) => {
      let order = req.body;
      await ordersCollection.insertOne(order);

      // sendInvoice(order, order.email, order.name);

      res.send({ success: true });
    });

    // Insert order data to the orders collection and send email invoice (Cash On Delivery)
    app.post("/orders/sslcommerz", async (req, res) => {
      let order = req.body;
      let tarnsactionID = new ObjectId().toString();
      const data = {
        total_amount: `${order.orderTotal}`,
        currency: "BDT",
        tran_id: tarnsactionID,
        success_url: `http://localhost:5000/payment/success/${tarnsactionID}`,
        fail_url: "http://localhost:5000/payment/failed",
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: `${order.name}`,
        cus_email: `${order.email}`,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
      });

      app.post("/payment/success/:tranID", async (req, res) => {
        await ordersCollection.insertOne(order);
        sendInvoice(order, order.email, order.name);
        res.redirect("http://localhost:5173/my-orders");
      });

      app.post("/payment/failed", async (req, res) => {
        res.redirect("http://localhost:5173/cart");
      });
    });

    // Update user's delivery address to the database
    app.post("/update-address", async (req, res) => {
      let { address, email } = req.body;
      const result = await addressCollection.updateOne(
        { email: email },
        { $set: { address: address } },
        { upsert: true }
      );

      if (result.upsertedCount > 0 || result.modifiedCount > 0) {
        res.send({ success: true });
      } else {
        res.send({ success: false, message: "No changes made" });
      }
    });

    // Update user's delivery address to the database
    app.post("/update-phone", async (req, res) => {
      let { phone, email } = req.body;
      const result = await addressCollection.updateOne(
        { email: email },
        { $set: { phone: phone } },
        { upsert: true }
      );

      if (result.upsertedCount > 0 || result.modifiedCount > 0) {
        res.send({ success: true });
      } else {
        res.send({ success: false, message: "No changes made" });
      }
    });

    // Get user's address
    app.get("/my-address", async (req, res) => {
      const email = req.query.email;
      const address = await addressCollection.findOne({ email: email });
      res.send(address);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is up and running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
