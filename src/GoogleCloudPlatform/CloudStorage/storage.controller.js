const processFile = require('../../middlewares/upload.middleware');
const { format } = require("util");
const { Storage } = require("@google-cloud/storage");

// Instantiate a storage client with credentials
const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const storage = new Storage({ keyFilename: keyFilename });
const bucket = storage.bucket("beanstalk-resources");

const uploadFile = async (req, res) => {
  console.log('CloudStore:: UploadFile')
  
    try {
        await processFile(req, res);
        console.log('file:')
        console.log('bucket: '+req.body.bucket);
        console.log(req.file);
        if (!req.file) {
          return res.status(400).send({  
            message: "Please upload a file!"
          });
        }
        let date = new Date();
        let timestampFile = Math.floor(date / 1000)
        var path = require('path')
        let fileExt = path.extname(req.file.originalname)
        let nameFile = timestampFile + fileExt
        console.log(nameFile)

        // Create a new blob in the bucket and upload the file data.
        const blob = bucket.file(req.body.bucket +"/"+ nameFile);
        const blobStream = blob.createWriteStream({
          resumable: false,
        });
        blobStream.on("error", (err) => {
          res.status(500).send({ 
            message: err.message });
        });
        blobStream.on("finish", async (data) => {
          // Create URL for directly file access via HTTP.
          // Add in Clients : https://storage.googleapis.com/
          const publicUrl = format(
            `${bucket.name}/${blob.name}`
          );
          try {
            // Make the file public
            await bucket.file(req.body.bucket +"/"+ nameFile).makePublic();
          } catch {
            return res.status(500).send({
              message: `Uploaded the file successfully: ${req.file.originalname}, but public access is denied!`,
              url: publicUrl,
            });
          }
          res.status(200).send({
            message: "Uploaded the file successfully: " + req.file.originalname,
            url: publicUrl,
          });
        });
        blobStream.end(req.file.buffer);
      } catch (err) {
        if (err.code == "LIMIT_FILE_SIZE") {
          return res.status(500).send({
            message: "File size cannot be larger than 2MB!",
          });
        }
        res.status(500).send({
          message: `Could not upload the file: ${req.file.originalname}. ${err}`,
        });
      }
    
};

// const getListFiles = async (req, res) => {
//     ...
//   };
// const download = async (req, res) => {
//     ...
//   };

module.exports = {
    uploadFile
};