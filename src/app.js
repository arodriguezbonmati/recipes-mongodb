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
        autor(nombre: String!): Autor
        ingrediente(nombre: String!): Ingredientes

        listaRecetas: [Recetas!]
        listaAutores: [Autor!]
        listaIngredientes: [Ingredientes!]
    }

    type Mutation{
        addAutor(nombre: String!, email: String!): Autor!
        addIngrediente(nombre: String!): Ingredientes!
        addReceta(titulo: String!, descripcion: String!, autor: String!, ingredientes: [String!]): Recetas!

        deleteReceta(titulo: String!): String!
        deleteAutor(nombre: String!): String!
        deleteIngrediente(nombre: String!): String!

        editAutor(nombre: String!, email: String): Autor
        editReceta(titulo: String!, descripcion: String, autor: String, ingredientes: [String!]): Recetas
        editIngrediente(nombre: String!, nombre_nuevo: String!): Ingredientes
    }
 

`


    const resolvers = {

        Autor: {
            lista_recetas: (parent, args, ctx, info) => {
                const autorNombre = parent.nombre;
                return recetasData.filter(obj => obj.autor === autorNombre);

            }
        },

        Ingredientes: {
            recetas_aparece: (parent, args, ctx, info) => {
                const ingredienteNombre = parent.nombre;
                return recetasData.filter(obj => obj.ingredientes.includes(ingredienteNombre));
            }
        },

        Recetas: {
            autor: (parent, args, ctx, info) => {
                const autorEmail = parent.autor;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("autores");

                return collection.findOne({email: autorEmail})
            },

            ingredientes: (parent, args, ctx, info) => {
                const nombreIngredientes = parent.ingredientes;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("ingredientes");

                return collection.findOne({nombre: nombreIngredientes})

            }
        },

        Query: {
            autor: (parent, args, ctx, info) => {
                return autorData.find(obj => obj.nombre === args.nombre);
            },

            ingrediente: (parent, args, ctx, info) => {
                return ingredientesData.find(obj => obj.nombre === args.nombre);
            },

            listaRecetas: (parent, args, ctx, info) => {
                return recetasData;
            },

            listaAutores: (parent, args, ctx, info) => {
                return autorData;
            },

            listaIngredientes: (parent, args, ctx, info) => {
                return ingredientesData;
            }


        },

        Mutation: {
            addAutor: async (parent, args, ctx, info) => {
                const { nombre, email } = args;
                const { client } = ctx;

                const db = client.db("recetas");
                const collection = db.collection("autores");
                if(await collection.findOne({email: email})){
                    throw new Error (`Email ${email} already in use`)
                }

                const result = await collection.insertOne({nombre, email});

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
                if(await collection.findOne({nombre: nombre})){
                    throw new Error (`${nombre} has already been added`)
                }

                const result = await collection.insertOne({nombre});

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

                if(await collection.findOne({titulo: titulo})){
                    throw new Error(`${titulo} already in use`)
                }

                if(await !autorescollection.findOne({email: autor})){
                    throw new Error(`${autor} doesn't exist`)
                }

                if(await !ingredientescollection.findOne({nombre: ingredientes})){
                    throw new Error(`${ingredientes} doesn't exist`)
                }

                var today = new Date();
                var dd = String(today.getDate()).padStart(2, '0');
                var mm = String(today.getMonth() + 1).padStart(2, '0');
                var yyyy = today.getFullYear();
                today = `${dd}/${mm}/${yyyy}`;
                const fecha = today;

                const result = await collection.insertOne({titulo, descripcion, fecha, autor, ingredientes})

                return {
                    _id: result.ops[0]._id,
                    titulo,
                    descripcion,
                    fecha,
                    autor,
                    ingredientes
                }

                
            },

            deleteReceta: (parent, args, ctx, info) => {
                const receta = args.titulo;

                if (recetasData.some(obj => obj.titulo === receta)) {
                    const result = recetasData.find(obj => obj.titulo === receta);
                    const index = recetasData.indexOf(result);

                    recetasData.splice(index, 1);

                    return (`Successfully deleted ${receta}`)
                } else {
                    return (`Recipe ${receta} not found`)
                }


            },

            deleteAutor: (parent, args, ctx, info) => {
                const nombre = args.nombre;

                if (autorData.some(obj => obj.nombre === nombre)) {
                    const result = autorData.find(obj => obj.nombre === nombre);
                    const index = autorData.indexOf(result);

                    autorData.splice(index, 1);

                    recetasData.forEach(elem => {

                        const ff = elem.autor === nombre
                        if (ff) {
                            const index = recetasData.indexOf(ff)
                            recetasData.splice(index, 1);
                        }
                    })

                    return (`Deleted author ${nombre} successfully`)
                } else {
                    return (`Author ${nombre} not found`)
                }


            },

            deleteIngrediente: (parent, args, ctx, info) => {
                const nombre = args.nombre;

                const result = ingredientesData.filter(obj => obj.nombre === nombre);
                if (ingredientesData.some(obj => obj.nombre === nombre)) {
                    ingredientesData.forEach(elem => {
                        const ff = elem.nombre === nombre;
                        if (ff) {
                            ingredientesData.indexOf(ff)
                            ingredientesData.splice(ff, 1)
                        }
                    })

                    return (`Ingredient ${nombre} deleted successfully`)
                } else {
                    return (`Ingredient ${nombre} not found`)
                }
            },

            editAutor: (parent, args, ctx, info) => {
                const email = args.email;

                if (email) {
                    const nombre = args.nombre;

                    if (autorData.some(obj => obj.nombre === nombre)) {
                        const result = autorData.find(obj => obj.nombre === nombre);
                        const index = autorData.indexOf(result);
                        autorData[index].email = email

                        const f = autorData.find(obj => obj.nombre === nombre);

                        return f;
                    }
                }
            },

            editReceta: (parent, args, ctx, info) => {
                const descripcion = args.descripcion;
                const autor = args.autor;
                const ingredientes = args.ingredientes;
                const titulo = args.titulo;
                if (descripcion) {
                    if (recetasData.some(obj => obj.titulo === titulo)) {
                        const result = recetasData.find(obj => obj.titulo === titulo);
                        const index = recetasData.indexOf(result);
                        recetasData[index].descripcion = descripcion;
                    }
                }
                if (autor) {
                    const aut = autorData.some(obj => obj.nombre === autor);
                    if (aut) {
                        if (recetasData.some(obj => obj.titulo === titulo)) {
                            const result = recetasData.find(obj => obj.titulo === titulo);
                            const index = recetasData.indexOf(result);
                            recetasData[index].autor = autor;
                        }
                    }
                    if (!aut || null) {
                        return (`Autor ${autor} not found`)
                    }
                }
                if (ingredientes) {
                    const ing = ingredientesData.some(obj => obj.nombre === ingredientes);
                    if (ing) {
                        if (recetasData.some(obj => obj.titulo === titulo)) {
                            const result = recetasData.find(obj => obj.titulo === titulo);
                            const index = recetasData.indexOf(result);
                            recetasData[index].ingredientes = ingredientes;
                        }
                    }
                    if (!ing || null) {
                        return (`Ingredient ${ingredientes} not found.`)
                    }
                }

                const f = recetasData.find(obj => obj.titulo === titulo);
                return f;
            },

            editIngrediente: (parent, args, ctx, info) => {
                const nombre = args.nombre;
                const nombre_nuevo = args.nombre_nuevo;

                const gg = ingredientesData.some(obj => obj.nombre === nombre);
                if (gg) {
                    const result = ingredientesData.find(obj => obj.nombre === nombre);
                    const index = ingredientesData.indexOf(result);
                    ingredientesData[index].nombre = nombre_nuevo;

                    const f = ingredientesData.find(obj => obj.nombre === nombre_nuevo);
                    return f;
                }
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





