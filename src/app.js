import { MongoClient, ObjectID } from "mongodb";
import { GraphQLServer } from 'graphql-yoga'

import "babel-polyfill"

const usr = "usuario1";
const pwd = "12345qwerty";
const url = "cluster1-zxbet.mongodb.net/test?retryWrites=true&w=majority";


/**
 * Connects to MongoDB Server and returns connected client
 * @param {string} usr MongoDB Server user
 * @param {string} pwd MongoDB Server pwd
 * @param {string} url MongoDB Server url
 */

const connectToDb = async function (usr, pwd, url) {
    const uri = `mongodb+srv://${usr}:${pwd}@${url}`;
    const client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    await client.connect();
    return client;
};


const runGraphQLServer = function (context) {
    const typeDefs = `

    type Recetas{
        _id: ID!
        titulo: String!
        descripcion: String!
        fecha: String!
        autor: Autor
        ingredientes: [Ingredientes!]
    }

    type Autor{
        _id: ID!
        nombre: String!
        email: String!
        lista_recetas: [Recetas!]
    }

    type Ingredientes{
        _id: ID!
        nombre: String!
        recetas_aparece: [Recetas!]
    }

    type Query{
        autor(id: ID!): Autor
        ingrediente(id: ID!): Ingredientes

        listaRecetas: [Recetas!]
        listaAutores: [Autor!]
        listaIngredientes: [Ingredientes!]
    }

    type Mutation{
        addAutor(nombre: String!, email: String!): Autor!
        addIngrediente(nombre: String!): Ingredientes!
        addReceta(titulo: String!, descripcion: String!, autor: String!, ingredientes: [String!]): Recetas!

        deleteReceta(id: ID!): String!
        deleteAutor(email: String!): String!
        deleteIngrediente(nombre: String!): String!

        editAutor(id: ID!, nuevoNombre: String, nuevoEmail: String): Autor
        editReceta(id: ID!, titulo: String, descripcion: String, autor: String, ingredientes: [String!]): Recetas
        editIngrediente(id: ID!, nuevoNombre: String!): Ingredientes
    }
 

`


    const resolvers = {

        Autor: {
            lista_recetas: async (parent, args, ctx, info) => {
                const email1 = parent.email;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("recetas");

                const result = await collection.find({ autor: email1 }).toArray();
                return result;
            }
        },

        Ingredientes: {
            recetas_aparece: async (parent, args, ctx, info) => {
                const ingrediente = parent.nombre;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("recetas");

                const result = await collection.find({ ingredientes: ingrediente }).toArray();
                return result;
            }
        },

        Recetas: {
            autor: (parent, args, ctx, info) => {
                const autorEmail = parent.autor;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("autores");

                return collection.findOne({ email: autorEmail })
            },

            ingredientes: async (parent, args, ctx, info) => {
                const ingredientesArr = [];
                const nombreIngredientes = parent.ingredientes;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("ingredientes");

                nombreIngredientes.forEach(elem => {
                    ingredientesArr.push(collection.findOne({ nombre: elem }))
                })

                const ing = await Promise.all(ingredientesArr)

                return ing;

            }
        },

        Query: {
            autor: async (parent, args, ctx, info) => {
                const id = args;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("autores");

                const result = await collection.findOne({ _id: ObjectID(id) });
                return result;

            },

            ingrediente: async (parent, args, ctx, info) => {
                const id = args;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("ingredientes");

                const result = await collection.findOne({ _id: ObjectID(id) });
                return result;
            },

            listaRecetas: async (parent, args, ctx, info) => {
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("recetas");

                const result = await collection.find({}).toArray();

                return result;
            },

            listaAutores: async (parent, args, ctx, info) => {
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("autores");

                const result = await collection.find({}).toArray();

                return result;
            },

            listaIngredientes: async (parent, args, ctx, info) => {
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("ingredientes");

                const result = await collection.find({}).toArray();

                return result;
            }


        },

        Mutation: {
            addAutor: async (parent, args, ctx, info) => {
                const { nombre, email } = args;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("autores");
                if (await collection.findOne({ email: email })) {
                    throw new Error(`Email ${email} already in use`)
                }

                const result = await collection.insertOne({ nombre, email });

                return {
                    nombre,
                    email,
                    _id: result.ops[0]._id
                };
            },

            addIngrediente: async (parent, args, ctx, info) => {
                const { nombre } = args;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("ingredientes");
                if (await collection.findOne({ nombre: nombre })) {
                    throw new Error(`${nombre} has already been added`)
                }

                const result = await collection.insertOne({ nombre });

                return {
                    nombre,
                    _id: result.ops[0]._id
                }


            },

            addReceta: async (parent, args, ctx, info) => {
                const { titulo, descripcion, autor, ingredientes } = args;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("recetas");

                const autoresdb = client.db("recetas");
                const autorescollection = autoresdb.collection("autores");

                const ingredientesdb = client.db("recetas");
                const ingredientescollection = ingredientesdb.collection("ingredientes");

                if (await collection.findOne({ titulo: titulo })) {
                    throw new Error(`${titulo} already in use`)
                }

                if (await !autorescollection.findOne({ email: autor })) {
                    throw new Error(`${autor} doesn't exist`)
                }

                if (await !ingredientescollection.findOne({ nombre: ingredientes })) {
                    throw new Error(`${ingredientes} doesn't exist`)
                }

                var today = new Date();
                var dd = String(today.getDate()).padStart(2, '0');
                var mm = String(today.getMonth() + 1).padStart(2, '0');
                var yyyy = today.getFullYear();
                today = `${dd}/${mm}/${yyyy}`;
                const fecha = today;

                const result = await collection.insertOne({ titulo, descripcion, fecha, autor, ingredientes })

                return {
                    _id: result.ops[0]._id,
                    titulo,
                    descripcion,
                    fecha,
                    autor,
                    ingredientes
                }


            },

            deleteReceta: async (parent, args, ctx, info) => {
                const { id } = args;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("recetas");
                await collection.deleteOne({ "_id": ObjectID(id) }, true);

                return "Removed"


            },

            deleteAutor: async (parent, args, ctx, info) => {
                const { email } = args;
                const { client } = ctx;

                const db = client.db("recetas");
                let collection = db.collection("autores");

                await collection.deleteOne({ "email": email})
                collection = db.collection("recetas");
                await collection.deleteMany({"autor": email})

                return "Removed"
            },

            deleteIngrediente: async (parent, args, ctx, info) => {
                const { nombre } = args;
                const { client } = ctx;

                const db = client.db("recetas");
                let collection = db.collection("ingredientes");

                await collection.deleteOne({ "nombre": nombre})
                collection = db.collection("recetas");
                await collection.deleteMany({"ingredientes": nombre})

                return "Removed"
            },

            editAutor: async (parent, args, ctx, info) => {
                const { id, nuevoNombre, nuevoEmail } = args;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("autores");

                if (nuevoNombre) {
                    await collection.updateOne({ "_id": ObjectID(id) }, { $set: { "nombre": nuevoNombre } });
                }

                if (nuevoEmail) {
                    await collection.updateOne({ "_id": ObjectID(id) }, { $set: { "email": nuevoEmail } });
                }

                const result = collection.findOne({ _id: ObjectID(id) })

                return result;

            },

            editReceta: async (parent, args, ctx, info) => {
                const { id, titulo, descripcion, autor, ingredientes } = args;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("recetas");

                if (titulo) {
                    await collection.updateOne({ "_id": ObjectID(id) }, { $set: { "titulo": titulo } });
                }

                if (descripcion) {
                    await collection.updateOne({ "_id": ObjectID(id) }, { $set: { "descripcion": descripcion } });
                }

                if (autor) {
                    await collection.updateOne({ "_id": ObjectID(id) }, { $set: { "autor": autor } });
                }

                if (ingredientes) {
                    await collection.updateOne({ "_id": ObjectID(id) }, { $set: { "ingredientes": ingredientes } });
                }

                const result = collection.findOne({ _id: ObjectID(id) })

                return result;
            },

            editIngrediente: async (parent, args, ctx, info) => {
                const { id, nuevoNombre } = args;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("ingredientes");

                await collection.updateOne({ "_id": ObjectID(id) }, { $set: { "nombre": nuevoNombre } })

                const result = collection.findOne({ "_id": ObjectID(id) })

                return result;
            }


        }

    }

    const server = new GraphQLServer({ typeDefs, resolvers, context });
    const options = {
        port: 8000
    };

    try {
        server.start(options, ({ port }) =>
            console.log(
                `Server started, listening on port ${port} for incoming requests.`
            )
        );
    } catch (e) {
        console.info(e);
        server.close();
    }

};


const runApp = async function () {
    const client = await connectToDb(usr, pwd, url);
    console.log("Connect to Mongo DB");
    try {
        runGraphQLServer({ client });
    } catch (e) {
        client.close();
    }
};

runApp();