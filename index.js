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
    origin: [
      "http://localhost:5173",
      "http://localhost:3001",
      "https://dine-dash-client.web.app",
      "https://dinedash-dashboard.web.app",
    ],
    credentials: true,
  })
);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { sendInvoice } = require("./Utility/SendInvoice/SendInvoice");
const {
  sendInstruction,
} = require("./Utility/SendInstruction/SendInstruction");
const {
  PartnerRequestRejected,
} = require("./Utility/PartnerRequestRejected/PartnerRequestRejected");
const {
  SendInstructionToRider,
} = require("./Utility/SendIntructionToRider/SendInstructionToRider");
const {
  RiderRequestRejected,
} = require("./Utility/RiderRequestRejected/RiderRequestRejected");

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
  const sslcommerzCollection = client.db("DineDash").collection("sslcommerz");
  const partnerRequestsCollection = client
    .db("DineDash")
    .collection("partnerRequests");
  const riderRequestsCollection = client
    .db("DineDash")
    .collection("riderRequests");
  const rolesCollection = client.db("DineDash").collection("userRoles");
  const ridersCollection = client.db("DineDash").collection("riders");

  try {
    // Get Provider names and images
    app.get("/providers", async (req, res) => {
      const result = await providersCollection.find().toArray();
      res.send(result);
    });

    // Get Restaurents for homepage slider
    app.get("/restaurants", async (req, res) => {
      const result = await restaurantsCollection.find().toArray();
      res.send(result);
    });

    // Get All riders for admin overview
    app.get("/all-riders", async (req, res) => {
      const result = await ridersCollection.find().toArray();
      res.send(result);
    });

    // Get total orders placed for admin overview
    app.get("/all-orders", async (req, res) => {
      const result = await ordersCollection.find().toArray();
      res.send(result);
    });

    // Get total orders placed for partners/restaurants overview
    app.get("/all-orders/partner", async (req, res) => {
      let restaurant = req.query.name;

      const regularOrders = await ordersCollection
        .find({
          "cartFood.restaurant": restaurant,
        })
        .toArray();

      const customOrders = await ordersCollection
        .find({
          "burger.provider": restaurant,
        })
        .toArray();

      res.json({ regularOrders, customOrders });
    });

    // Get total orders delivered for partners/restaurants overview
    app.get("/orders-delivered/total", async (req, res) => {
      let restaurant = req.query.name;

      const totalRegularOrdersDelivered = await ordersCollection
        .find({
          "cartFood.restaurant": restaurant,
          "cartFood.status": "completed",
        })
        .toArray();

      const totalCustomOrdersDelivered = await ordersCollection
        .find({
          "burger.provider": restaurant,
          "burger.status": "completed",
        })
        .toArray();

      res.json({ totalRegularOrdersDelivered, totalCustomOrdersDelivered });
    });

    // Get total earned for partners/restaurants overview
    app.get("/total-earned", async (req, res) => {
      let restaurant = req.query.name;

      const totalRegularOrdersDelivered = await ordersCollection
        .find({
          "cartFood.restaurant": restaurant,
          "cartFood.status": "completed",
        })
        .toArray();

      const totalCustomOrdersDelivered = await ordersCollection
        .find({
          "burger.provider": restaurant,
          "burger.status": "completed",
        })
        .toArray();

      // Calculate total earned from regular orders
      const totalRegularEarned = totalRegularOrdersDelivered.reduce(
        (acc, order) => {
          // Sum the totalPrice of each burger in the burger array
          const regularTotal = order.cartFood.reduce((acc, regularItem) => {
            return acc + parseInt(regularItem.totalPrice);
          }, 0);
          // Add the sum to the accumulator
          return acc + regularTotal;
        },
        0
      );

      // Calculate total earned from custom orders
      const totalCustomEarned = totalCustomOrdersDelivered.reduce(
        (acc, order) => {
          // Sum the totalPrice of each burger in the burger array
          const burgerTotal = order.burger.reduce((burgerAcc, burgerItem) => {
            return burgerAcc + parseInt(burgerItem.totalPrice);
          }, 0);
          // Add the sum to the accumulator
          return acc + burgerTotal;
        },
        0
      );

      const grandTotal = totalRegularEarned + totalCustomEarned;

      res.json({ grandTotal });
    });

    // Get all restaurants and their details fro admin overview
    app.get("/restaurants-and-details", async (req, res) => {
      const allRestaurants = await restaurantsCollection.find().toArray();

      const restaurantsWithData = [];

      for (const restaurant of allRestaurants) {
        const foods = await foodsCollection
          .find({ restaurant: restaurant.name })
          .toArray();

        const restaurantWithData = {
          restaurant: restaurant,
          foods: foods,
        };
        restaurantsWithData.push(restaurantWithData);
      }

      res.send(restaurantsWithData);
    });

    // Get all registered riders for admin overview
    app.get("/all-registered-riders", async (req, res) => {
      const result = await ridersCollection.find().toArray();
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

      let detailsForInvoice = await ordersCollection.findOne({
        randString: order.randString,
      });

      await sendInvoice(
        detailsForInvoice,
        detailsForInvoice.email,
        detailsForInvoice.name
      );

      res.send({ success: true });
    });

    // Insert order data to the orders collection and send email invoice (SSLCOMMERZ)
    app.post("/orders/sslcommerz", async (req, res) => {
      let order = req.body;

      await sslcommerzCollection.insertOne(order);

      let transactionId = new ObjectId().toString();
      const data = {
        total_amount: `${order.orderTotal}`,
        currency: "BDT",
        tran_id: transactionId,
        success_url: `https://dine-dash-server.vercel.app/payment/success/${transactionId}/${order.randString}`,
        fail_url: `https://dine-dash-server.vercel.app/payment/failed`,
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

      app.post("/payment/success/:tranID/:oid", async (req, res) => {
        let oid = req.params.oid;

        let orderToCommit = await sslcommerzCollection.findOne({
          randString: oid,
        });

        await ordersCollection.insertOne(orderToCommit);

        await sendInvoice(
          orderToCommit,
          orderToCommit.email,
          orderToCommit.name
        );

        let redirectTo;
        if (orderToCommit.cartFood?.length > 0) {
          redirectTo = "myOrders";
        } else {
          redirectTo = "customMadeBurgers";
        }

        res.redirect(
          `https://dine-dash-client.web.app/order-success/${redirectTo}`
        );
      });

      app.post("/payment/failed", async (req, res) => {
        res.redirect("https://dine-dash-client.web.app/payment-cancelled");
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

    // Get all orders of a user
    app.get("/my-orders", async (req, res) => {
      const email = req.query.email;

      let result = await ordersCollection
        .find({ email: email })
        .project({
          _id: 1,
          cartFood: 1,
          burger: 1,
          date: 1,
          status: 1,
          order: 1,
        })
        .toArray();

      result.sort((a, b) => b.order - a.order);

      res.send(result);
    });

    // Store partner request to the database
    app.post("/partner-request", async (req, res) => {
      let data = req.body;
      await partnerRequestsCollection.insertOne(data);
      res.send({ success: true });
    });

    // Get partner request status
    app.get("/partner-request", async (req, res) => {
      let email = req.query.email;
      let result = await partnerRequestsCollection.findOne({ email: email });
      res.send(result);
    });

    // Get all partner request for admin
    app.get("/partner-requests", async (req, res) => {
      let result = await partnerRequestsCollection
        .find({ status: "pending" })
        .toArray();
      res.send(result);
    });

    // Get user role
    app.get("/get-role", async (req, res) => {
      let email = req.query.email;
      let result = await rolesCollection.findOne({ email: email });
      res.send(result);
    });

    // Accept partner request
    app.post("/accept/partner-request", async (req, res) => {
      let data = req.body;

      await sendInstruction(data.email, data.name);

      await partnerRequestsCollection.updateOne(
        { email: data.email },
        { $set: { status: "accepted" } }
      );

      let insertToRoleCollection = {
        email: data.email,
        role: "restaurant-handler",
      };

      await rolesCollection.insertOne(insertToRoleCollection);

      res.send({ success: true });
    });

    // Reject partner request
    app.post("/reject/partner-request", async (req, res) => {
      let email = req.body.email;
      let name = req.body.name;

      await PartnerRequestRejected(email, name);

      await partnerRequestsCollection.updateOne(
        { email: email },
        { $set: { status: "rejected" } }
      );

      res.send({ success: true });
    });

    // Register a restaurant
    app.post("/register-restaurant", async (req, res) => {
      let data = req.body;

      let insertToRestaurantsCollection = {
        name: data.restaurantName,
        thumbnail: data.thumbnail,
        pathname: data.restaurantName.toLowerCase().replace(/\s+/g, "-"),
      };

      await partnerRequestsCollection.updateOne(
        { email: data.email },
        { $set: { resolved: true } }
      );

      await restaurantsCollection.insertOne(insertToRestaurantsCollection);

      res.send({ success: true });
    });

    // Store rider requests to the database
    app.post("/rider-request", async (req, res) => {
      let data = req.body;
      await riderRequestsCollection.insertOne(data);
      res.send({ success: true });
    });

    // Get rider request status
    app.get("/rider-request", async (req, res) => {
      let email = req.query.email;
      let result = await riderRequestsCollection.findOne({ email: email });
      res.send(result);
    });

    // Get all rider request for admin
    app.get("/rider-requests", async (req, res) => {
      let result = await riderRequestsCollection
        .find({ status: "pending" })
        .toArray();
      res.send(result);
    });

    // Accept rider request
    app.post("/accept/rider-request", async (req, res) => {
      let data = req.body;

      await SendInstructionToRider(data.email, data.name);

      await riderRequestsCollection.updateOne(
        { email: data.email },
        { $set: { status: "accepted" } }
      );

      let insertToRoleCollection = {
        email: data.email,
        role: "rider",
      };

      await rolesCollection.insertOne(insertToRoleCollection);

      res.send({ success: true });
    });

    // Reject rider request
    app.post("/reject/rider-request", async (req, res) => {
      let email = req.body.email;
      let name = req.body.name;

      await RiderRequestRejected(email, name);

      await riderRequestsCollection.updateOne(
        { email: email },
        { $set: { status: "rejected" } }
      );

      res.send({ success: true });
    });

    // Get rider request status
    app.get("/rider-request-status", async (req, res) => {
      let email = req.query.email;
      let result = await riderRequestsCollection.findOne({ email: email });
      res.send(result);
    });

    // Register Rider
    app.post("/register-rider", async (req, res) => {
      let data = req.body;

      let insertToRidersCollection = {
        name: data.name,
        phone: data.phone,
        region: data.region,
      };

      await riderRequestsCollection.updateOne(
        { email: data.email },
        { $set: { resolved: true } }
      );

      await ridersCollection.insertOne(insertToRidersCollection);

      res.send({ success: true });
    });

    // Get regular orders data for the restaurant handler
    app.get("/orders/partner", async (req, res) => {
      let restaurantName = req.query.name;

      const filteredOrders = await ordersCollection
        .find({
          "cartFood.restaurant": restaurantName,
        })
        .project({
          _id: 1,
          cartFood: {
            $filter: {
              input: "$cartFood",
              as: "item",
              cond: { $eq: ["$$item.restaurant", restaurantName] },
            },
          },
          name: 1,
          address: 1,
          phone: 1,
          region: 1,
          orderTotal: 1,
          paymentMethod: 1,
        })
        .toArray();

      res.send(filteredOrders);
    });

    // Accept regular order
    app.post("/accept/order/regular", async (req, res) => {
      let orderId = req.body.orderId;

      const acceptOrder = await ordersCollection.updateOne(
        {
          "cartFood.orderId": orderId,
        },
        {
          $set: {
            "cartFood.$.status": "cooking",
          },
        }
      );

      res.send({ success: true });
    });

    // Deliver order to rider
    app.post("/deliver/order/regular", async (req, res) => {
      let orderId = req.body.orderId;

      const deliverOrder = await ordersCollection.updateOne(
        {
          "cartFood.orderId": orderId,
        },
        {
          $set: {
            "cartFood.$.status": "out for delivery",
          },
        }
      );

      res.send({ success: true });
    });

    // Reject regular order
    app.post("/reject/order/regular", async (req, res) => {
      let orderId = req.body.orderId;

      const rejectOrder = await ordersCollection.updateOne(
        {
          "cartFood.orderId": orderId,
        },
        {
          $set: {
            "cartFood.$.status": "cancelled",
          },
        }
      );

      res.send({ success: true });
    });

    // Get provider status (if a restaurant provides custom burger service or not)
    app.get("/provider/status", async (req, res) => {
      let name = req.query.name;
      let query = { provider: name };
      const result = await providersCollection.findOne(query);
      res.send(result);
    });

    // Insert custom burger provider details to the database
    app.post("/become-provider", async (req, res) => {
      let data = req.body;
      const result = await providersCollection.insertOne(data);
      res.send(result);
    });

    // Update burger ingredients price
    app.post("/update/ingredients/price", async (req, res) => {
      const updatedPrice = req.body.updatedPrice;
      const providerName = req.body.provider;
      const ingredientToUpdate = req.body.ingredientToUpdate;

      await providersCollection.findOneAndUpdate(
        { provider: providerName, "ing.name": ingredientToUpdate },
        { $set: { "ing.$.price": parseInt(updatedPrice) } }
      );

      res.send({ success: true });
    });

    // Get custom burger orders data for the restaurant handler
    app.get("/custom/orders/partner", async (req, res) => {
      let restaurantName = req.query.name;

      const filteredOrders = await ordersCollection
        .find({
          "burger.provider": restaurantName,
        })
        .project({
          _id: 1,
          burger: {
            $filter: {
              input: "$burger",
              as: "item",
              cond: { $eq: ["$$item.provider", restaurantName] },
            },
          },
          name: 1,
          address: 1,
          phone: 1,
          region: 1,
          orderTotal: 1,
          paymentMethod: 1,
        })
        .toArray();

      res.send(filteredOrders);
    });

    // Accept custom burger order
    app.post("/accept/order/custom", async (req, res) => {
      let orderId = req.body.orderId;

      const acceptOrder = await ordersCollection.updateOne(
        {
          "burger.orderId": orderId,
        },
        {
          $set: {
            "burger.$.status": "cooking",
          },
        }
      );

      res.send({ success: true });
    });

    // Reject custom burger order
    app.post("/reject/order/custom", async (req, res) => {
      let orderId = req.body.orderId;

      let rejectOrder = await ordersCollection.updateOne(
        {
          "burger.orderId": orderId,
        },
        {
          $set: {
            "burger.$.status": "cancelled",
          },
        }
      );

      res.send({ success: true });
    });

    // Deliver custom burger order to rider
    app.post("/deliver/order/custom", async (req, res) => {
      let orderId = req.body.orderId;

      const deliverOrder = await ordersCollection.updateOne(
        {
          "burger.orderId": orderId,
        },
        {
          $set: {
            "burger.$.status": "out for delivery",
          },
        }
      );

      res.send({ success: true });
    });

    // Insert new food to the database
    app.post("/add/new/food", async (req, res) => {
      let foodDetails = req.body;

      let convertedPrice = parseInt(foodDetails.price);

      foodDetails.price = convertedPrice;

      await foodsCollection.insertOne(foodDetails);

      res.send({ success: true });
    });

    // Get foods offered by individual restaurants
    app.get("/offered/foods", async (req, res) => {
      let restaurantName = req.query.restaurant;

      let foods = await foodsCollection
        .find({ restaurant: restaurantName })
        .toArray();

      res.send(foods);
    });

    // Update food details
    app.post("/update/food", async (req, res) => {
      let id = req.query.id;
      let updatedDetails = req.body;

      const objectId = new ObjectId(id);

      const result = await foodsCollection.updateOne(
        { _id: objectId },
        { $set: updatedDetails }
      );

      res.send({ success: true });
    });

    // Delete food
    app.post("/delete/food", async (req, res) => {
      let id = req.query.id;
      const objectId = new ObjectId(id);
      await foodsCollection.deleteOne({ _id: objectId });
      res.send({ success: true });
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
