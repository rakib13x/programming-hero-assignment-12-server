const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// CORS middleware
//middleware
app.use(cookieParser());
// const corsOptions = {
//   origin: "https://shiply-ea44d.web.app", // Replace with your frontend domain
//   credentials: true, // Enable credentials (cookies, authorization headers, etc.)
// };

app.use(cors());
app.use(express.json());

// console.log(process.env.DB_PASS);
// console.log(process.env.DB_User);

app.get("/", (req, res) => {
  res.send("shiply is Running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kyfxv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    // Send a ping to confirm a successful connection
    //bistro Database

    const userCollection = client.db("shiplyDb").collection("users");
    const bookingCollection = client.db("shiplyDb").collection("bookings");
    const reviewCollection = client.db("shiplyDb").collection("reviews");
    const paymentCollection = client.db("shiplyDb").collection("payments");

    //jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10h",
      });
      res.send({ token });
    });

    //middlewares
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
      // next();
    };

    //use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //use delivery Man after verifyToken
    const verifyDeliveryMan = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isDeliveryMan = user?.role === "deliveryman";
      if (!isDeliveryMan) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //users related api
    app.get(
      "/users",
      verifyToken,
      verifyAdmin,

      async (req, res) => {
        // console.log(req.headers);
        const result = await userCollection.find().toArray();

        res.send(result);
      }
    );

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }

      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      //insert email if user doesn't exists:
      //you can do this many ways (1.email unique ,2.upsert, 3. simple checking)
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.delete(
      "/users/:id",
      verifyToken,
      verifyAdmin,

      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      }
    );
    //deliveryMan Api
    app.get("/users/deliveryman/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query, filter);
      let deliveryMan = false;
      if (user) {
        deliveryMan = user?.role === "deliveryman";
      }

      res.send({ deliveryMan });
    });

    app.patch(
      "/users/deliveryman/:id",
      verifyToken,
      verifyAdmin,

      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "deliveryman",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
        // console.log(result);
      }
    );

    //booking related apis

    app.get("/bookings", async (req, res) => {
      let query = {}; // Default query to fetch all data

      // If fromDate and toDate are provided, update the query
      if (req.query.fromDate && req.query.toDate) {
        query = {
          bookingDate: {
            $gte: req.query.fromDate,
            $lte: req.query.toDate,
          },
        };
      }

      const result = await bookingCollection.find(query).toArray();
      console.log(result);

      res.send(result);
    });
    // app.get("/bookings", async (req, res) => {
    //   const fromDate = req.query.fromDate;
    //   let toDate = req.query.toDate;

    //   // Set the time part of toDate to 23:59:59.999
    //   const endTime = new Date(toDate);
    //   endTime.setHours(23, 59, 59, 999);

    //   const query = {
    //     bookingDate: {
    //       $gte: new Date(fromDate),
    //       $lte: endTime,
    //     },
    //   };

    //   console.log("Received fromDate:", fromDate);
    //   console.log("Received toDate:", toDate);
    //   console.log("Query:", query);

    //   const result = await bookingCollection.find(query).toArray();
    //   res.send(result);
    // });
    app.get("/bookings/:email", async (req, res) => {
      const email = req.params.email;
      console.log("received email", email);
      const query = { email: email };
      const result = await bookingCollection.find(query).toArray();

      res.send(result);
      // console.log(result);
    });
    app.patch("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log("Received PATCH request for booking ID:", id);
        console.log("Request Payload:", req.body);

        const filter = { _id: new ObjectId(id) };
        const { deliveryMenID, deliveryMenMail, approxDate } = req.body;
        console.log(
          "Received deliveryMenID:",
          deliveryMenID,
          deliveryMenMail,
          approxDate
        );

        // Log the existing document before the update
        const existingDocument = await bookingCollection.findOne(filter);
        console.log("Existing Document:", existingDocument);

        const updateDoc = {
          $set: {
            status: "on the way",
            deliveryMenID,
            deliveryMenMail,
            approxDate,
          },
        };

        const result = await bookingCollection.updateOne(filter, updateDoc);
        console.log("Update Result:", result);

        // Check if the document was found and modified
        if (result.matchedCount > 0) {
          res
            .status(200)
            .json({ success: true, message: "Booking updated successfully" });
        } else {
          res.status(404).json({
            success: false,
            message: "Booking not found or not updated",
          });
        }
      } catch (error) {
        console.error("Error in updateOne:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });
    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });
    app.put("/bookings/cancel/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log("Received cancel request for booking ID:", id);
        console.log("Request Payload:", req.body);

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "cancelled",
          },
        };

        const result = await bookingCollection.updateOne(filter, updateDoc);
        console.log("Cancel Result:", result);

        // Check if the document was found and modified
        if (result.matchedCount > 0) {
          res
            .status(200)
            .json({ success: true, message: "Booking canceled successfully" });
        } else {
          res.status(404).json({
            success: false,
            message: "Booking not found or not canceled",
          });
        }
      } catch (error) {
        console.error("Error in cancel request:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    app.put("/bookings/deliver/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log("Received deliver request for booking ID:", id);
        console.log("Request Payload:", req.body);

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "delivered",
          },
        };

        const result = await bookingCollection.updateOne(filter, updateDoc);
        console.log("Deliver Result:", result);

        // Check if the document was found and modified
        if (result.matchedCount > 0) {
          res
            .status(200)
            .json({ success: true, message: "Booking delivered successfully" });
        } else {
          res.status(404).json({
            success: false,
            message: "Booking not found or not delivered",
          });
        }
      } catch (error) {
        console.error("Error in deliver request:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    //deliveryman
    app.get("/deliverymen", async (req, res) => {
      const deliverymen = await userCollection
        .find({ role: "deliveryman" })
        .toArray();

      res.send(deliverymen);
    });

    //review api
    app.get(
      "/reviews",

      async (req, res) => {
        const result = await reviewCollection.find().toArray();

        res.send(result);
      }
    );

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    //payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find().toArray();

      res.send(result);
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //carefully delete each item from the cart
      console.log("payment info", payment);
      const query = {
        _id: {
          $in: payment.bookingIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await bookingCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });

    //topdeliverymen
    app.get("/topdeliveryman", async (req, res) => {
      const result = await userCollection.find().toArray();

      res.send(result);
    });

    //stats
    app.get("/stats", async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const booked = await bookingCollection.estimatedDocumentCount();
      const delivered = await bookingCollection
        .aggregate([
          {
            $match: {
              status: "delivered",
            },
          },
          {
            $group: {
              _id: null,
              totalDelivered: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              _id: 0, // Exclude _id field
              totalDelivered: 1,
            },
          },
        ])
        .toArray();

      res.send({ users, booked, delivered });
    });

    app.get("/topdeliverymen", async (req, res) => {
      try {
        // Get total users
        const users = await userCollection.estimatedDocumentCount();

        // Get total booked
        const booked = await bookingCollection.estimatedDocumentCount();

        // Get top 5 deliverymen based on total deliveries
        const topDeliverymen = await bookingCollection
          .aggregate([
            {
              $match: {
                status: "delivered",
              },
            },
            {
              $group: {
                _id: "$deliveryMenID",
                totalDeliveries: {
                  $sum: 1,
                },
              },
            },
            {
              $sort: {
                totalDeliveries: -1,
              },
            },
            {
              $limit: 5,
            },
            {
              $lookup: {
                from: "deliverymenCollection",
                localField: "_id",
                foreignField: "_id",
                as: "deliverymanDetails",
              },
            },
            {
              $project: {
                _id: 0,
                deliverymanID: "$_id",
                totalDeliveries: 1,
                deliverymanDetails: {
                  $arrayElemAt: ["$deliverymanDetails", 0],
                },
              },
            },
          ])
          .toArray();

        res.send({ topDeliverymen });
      } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Port is Running at ${port}`);
});
