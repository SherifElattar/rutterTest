var express = require('express');
var router = express.Router();
var axios = require('axios')
var mysql = require('mysql2/promise')

async function getMeta(userid,connection){
  sql = 'select meta_key, meta_value from wp_usermeta where user_id="'+userid+'" and meta_key in ("addr1","addr2","city","zip","country");'
  let[result,fields]=await connection.execute(sql,[2,2])
  returnlabel=result.map(e => e.meta_value).join("\n");
  sql = 'select meta_key, meta_value from wp_usermeta where user_id="'+userid+'" and meta_key in ("first_name","last_name","business_name");'
  let[result1,fields1]=await connection.execute(sql,[2,2])
  values = result1.map(e=>e.meta_value)
  meta= {'returnlabel':returnlabel,'businessname':values[0],'businesscontact':values[1]+' '+values[2]}
  return meta
}
async function getConnection ()
{
  const options =
  {
    host: "35.184.141.59", //IP address of my Cloud SQL Server
    user: 'Nodogoro',
    password: '',
    database: 'nuvane_wrdp1'
  };
  return mysql.createConnection(options);
}
sizeChart = {1:'S', 2:'XS', 3:'M', 4:'L', 5:'XL', 6:'2XL', 7:'3XL', 8:'4XL',9:'5XL'}
router.post('/rutterConnection',async function(req,res,next){
  connection_code = req.body['code']
  console.log(connection_code)
  if(connection_code=='ORDER_CREATED'){
    connection = await getConnection()
    items = req.body['order']['line_items']
    order =req.body['order']
    access_token =req.body['access_token']
    console.log(access_token)
    // console.log(order)
    let printauraItems = {'items':[]}
    let apikey = ''
    let apihash=''
    let userid=''
    let email = ''
    await Promise.all(items.map(async (item) => {
      rutterID = item['product_id']
      sku = item['sku']
      sql="select wp_users.user_email,wp_users.id as usersid,wp_users.apikey, wp_users.apihash, wp_users_products.id as product_id, wp_users_products_colors.size_id ,wp_users_products_colors.color_id from wp_users_products inner join wp_users on wp_users_products.users_id = wp_users.id inner join wp_users_products_colors on wp_users_products.id=wp_users_products_colors.users_products_id where wp_users_products.rutterID like '%" + rutterID + "%' and wp_users_products_colors.sku = '"+sku+"';"
      let[result,fields]=await connection.execute(sql,[2,2])
      email = result[0]['user_email']
      if(apikey!='' && apikey != result[0]['apikey']){
        console.log('flagged')
      }
      else{
        apikey = result[0]['apikey']
      }
      if(apihash!='' && apihash != result[0]['apihash']){
        console.log('flagged')
      }
      else{
        apihash = result[0]['apihash']
      }
      userid= result[0]['usersid']
      result[0]['product_id'] = result[0]['product_id']*565
      newItem = Object.keys(result[0]).filter(v => /_id\b/.test(v))
      .filter(key => key in result[0])
      .reduce((obj2, key) => (obj2[key] = result[0][key]+'', obj2), {});
      newItem['quantity'] = item['quantity']+''
      await printauraItems['items'].push(newItem)
    }));
    meta = await getMeta(userid,connection)
    console.log(meta)
    order['shipping_address']['clientname'] =order['shipping_address']['first_name'] +" "+ order['shipping_address']['last_name']
    clientname = order['shipping_address']['clientname']
    delete order['shipping_address']['first_name']
    delete order['shipping_address']['last_name']
    objectOrder = {'clientname':null,'address1':null,'address2':null,'region':null,'postal_code':null,'country_code':null}
    order['shipping_address'] = Object.assign(objectOrder,order['shipping_address'])
    shippingAddress =Object.values(order['shipping_address']).join('\n').trim()
    order['shipping_address']['state'] = order['shipping_address']['region']
    order['shipping_address']['country']= order['shipping_address']['country_code']
    order['shipping_address']['zip']= order['shipping_address']['postal_code']
    await ['region','country_code','postal_code','phone','clientname'].forEach(e => delete order['shipping_address'][e]);
    payload = {...meta,...order['shipping_address']}
    payload['items']=Buffer.from(JSON.stringify(printauraItems)).toString('base64')
    payload['shipping_address'] = shippingAddress
    payload['key']=apikey
    payload['hash']=apihash
    payload['method']='addorder1'
    payload['clientname']=clientname
    payload['shipping_id']=1
    payload["packingslip"]= ""
    payload["hang_tag_removal_price"] ="0"
    payload["tag_application_price"]= "0"
    payload["additional_material_price"] = "0"
    payload["rush"] = "0"
    payload["email"]=email
    if(order['customer']!=null)
      payload['customerphone'] = order['customer']['email']
    payload['your_order_id'] = "rutter,"+order['id']+','+access_token
    console.log(payload)
    let response = await axios({
        method: 'post',
        url: ' https://api.printaura.com/api.php',
        data:payload
      })

  }
  if(connection_code=='CONNECTION_UPDATED'){
    access_token = req.body['access_token']
    id = req.body['connection_id']
    let response = await axios({
        method: 'get',
        url: ' https://production.rutterapi.com/connections/access_token',
        params: {
            access_token: access_token
        },
        auth:{
          username:'6042cb5b-1d07-4c45-8eaf-c644c0c9581b',
          password: '46629b11-b78b-468b-9617-6985e21833c3'
        }
      })
        storeID = response['data']['connection']['store_unique_id']
        platform = response['data']['connection']['platform'].replace('_','').toLowerCase()

        // sql = 'select * from wp_users_'+platform +' where shop like "%'+storeID+'%";'
        sql = 'select * from wp_users where rutterTemp like "%'+access_token+'%";'
        console.log(sql)
        connection = await getConnection()
        let[result,fields]=await connection.execute(sql,[2,2])
        if(result.length>0){
          rutterConnection = result[0]['rutterConnection']
          if(rutterConnection==null)
            rutterConnection = {}
          else
            rutterConnection = JSON.parse(rutterConnection)
          rutterConnection[platform]=access_token
          rutterConnection =JSON.stringify(rutterConnection)
          sql = "update wp_users set rutterTemp=replace(ruttertemp,'"+access_token+"',''), rutterConnection='"+rutterConnection+"' where id="+ result[0]['ID']+";"
          let[result3,fields3]= await connection.execute(sql,[2,2])
          sql = "insert into wp_users_rutter(users_id,shop,platform) values("+result[0]['ID']+",'"+storeID +"','"+platform+"');"
          let[result4,fields4]= await connection.execute(sql,[2,2])
          res.send({msg:result3})
          }
          else{
            axios({
              method: 'delete',
              url: ' https://production.rutterapi.com/connections/'+id,
              auth:{
                username:'6042cb5b-1d07-4c45-8eaf-c644c0c9581b',
                password: '46629b11-b78b-468b-9617-6985e21833c3'
              }
            }).then(function(response2){
                res.send({msg:"success"})
            })
          }
      }
  else
    res.send({msg:'success'})
})
async function getVariants(input,cdnAlias,connection){
  sql = 'select sku,color_id,size_id,normalprice from wp_users_products_colors where users_products_id='+input+';'
  let[result3, err3] = await connection.execute(sql,[2,2])
  let variants = []
  await Promise.all(result3.map(async (s) => {
    sql = 'select wp_rmproductmanagement_colors.color_name,wp_rmproductmanagement_sizes.size_name from wp_rmproductmanagement_colors,wp_rmproductmanagement_sizes where wp_rmproductmanagement_colors.color_id='+s['color_id']+' and wp_rmproductmanagement_sizes.size_id = '+s['size_id']+';'
    let[detail,fields] = await connection.execute(sql,[2,2])
    sql = 'select wp_userfiles.fileName from wp_userfiles inner join wp_users_products_colors on wp_users_products_colors.image_id = wp_userfiles.fileId where wp_users_products_colors.sku ="'+s['sku']+'";'
    let [images,fields2] = await connection.execute(sql,[2,2])
    let imagesArray = await Promise.all(images.map(async (image) =>{
      imageURL = 'https://storage.googleapis.com/pa-uploads/users_uploads/' + cdnAlias + '/images/'+image['fileName']
      return {'src':imageURL}
    }))

    obj = {'sku': s['sku'],'images':imagesArray, 'option_values':[{'name':'color','value': detail[0]['color_name']},{'name':'size','value':detail[0]['size_name']}],'price':s['normalprice']}
    variants.push(obj)
  }));
  return variants
}
async function sendProductToRutter(product,rutterConnection,cdnAlias,connection){
  let rutterIDArr = []
  let sql = 'select filename from wp_users_products_images up inner join  wp_userfiles uf on up.image_id=uf.fileid where users_products_id = '+product['id']+';'
  let[imagesProd,fields] = await connection.execute(sql,[2,2])
  let imagesArrayProd = await Promise.all(imagesProd.map(async (imageprod) =>{
    imageURLProd = 'https://storage.googleapis.com/pa-uploads/users_uploads/' + cdnAlias + '/images/'+imageprod['filename']
    return {'src':imageURLProd}
  }))
  console.log(imagesArrayProd)
  let variants = await getVariants(product['id'],cdnAlias,connection)
  console.log(variants)
  payload = {
    "product": {
      "variants": variants,
      "name": product['title'],
      "description": Buffer.from(product['description'], 'base64').toString('ascii'),
      "status": "active",
      "images": imagesArrayProd
    }
  }
  variants=[]
  await Promise.all(Object.keys(rutterConnection).map(async (platform) => {
  key = rutterConnection[platform]
  // let prodRes = await axios({
  //     method: 'post',
  //     data:payload,
  //     url: ' https://production.rutterapi.com/products',
  //     params: {
  //         access_token: key
  //     },
  //     auth:{
  //       username:'6042cb5b-1d07-4c45-8eaf-c644c0c9581b',
  //       password: '46629b11-b78b-468b-9617-6985e21833c3'
  //     }
  //   })
  platformId = platform+'#'
  await rutterIDArr.push(platformId)
  console.log(rutterIDArr)
  if(product['rutterid']==null){
    rutterid = rutterIDArr.join()
  }
  else{
    rutterid = product['rutterid'] + ',' + rutterIDArr.join()
  }
  sql = "update wp_users_products set rutterAdded=1, rutterid = '"+rutterid+"' where id = "+product['id']+";"
  console.log(sql)
  let [result,err] = await connection.execute(sql,[2,2])

  return ""
        // res.send({msg:'success'})
  }))
}
router.post('/db',async function(req,res,next){
  // console.log(req.body)
  sql = "select * from wp_users_products where (created_at>=(current_timestamp()-interval 15 minute) and rutterAdded = 0) or (updated_at >=(current_timestamp() - interval 15 minute));"
  connection = await getConnection()
  let[result, fields] = await connection.execute(sql,[2,2])
  await Promise.all(result.map(async (product) => {
    if(product['rutterID'] != null){
      await(Promise.all(product['rutterID'].split(',').map(async(rutterIDTemp)=>{
        url = 'https://production.rutterapi.com/products/'+rutterIDTemp
        let response = await axios({
            method: 'delete',
            url: url,
            params: {
                access_token: access_token
            },
            auth:{
              username:'6042cb5b-1d07-4c45-8eaf-c644c0c9581b',
              password: '46629b11-b78b-468b-9617-6985e21833c3'
            }
        })
        console.log(response)
        })
      )
    )
    }
    sql = "select wp_users.rutterConnection, wp_usermeta.meta_value from wp_users inner join wp_usermeta on wp_users.id = wp_usermeta.user_id where wp_usermeta.meta_key= 'cdn_alias' and wp_users.id="+product['users_id']+";"
    let[result1, err1] = await connection.execute(sql,[2,2])
    let rutterConnection= await JSON.parse(result1[0]['rutterConnection'])
    if(rutterConnection!=null){
      let prodRes = await sendProductToRutter(product,rutterConnection,result1[0]['meta_value'],connection)
      // console.log(prodRes['data']['product']['variants'])

    }
  }))
  sql = "select distinct wp_rmproductmanagement_orders.orderid,wp_rmproductmanagement_orders.order_id, wp_rmproductmanagement_order_details.tracking,wp_rmproductmanagement_shipping_options.shipping_option_name from wp_rmproductmanagement_orders inner join wp_rmproductmanagement_order_details on wp_rmproductmanagement_orders.order_id=wp_rmproductmanagement_order_details.order_id inner join wp_rmproductmanagement_shipping_options on wp_rmproductmanagement_shipping_options.shipping_option_id = wp_rmproductmanagement_orders.shipping_method where wp_rmproductmanagement_order_details.tracking <> '' and wp_rmproductmanagement_orders.rutterAdded=0 and wp_rmproductmanagement_orders.orderid like '#rutter%' and not exists (select * from wp_rmproductmanagement_order_details where wp_rmproductmanagement_orders.order_id = wp_rmproductmanagement_order_details.order_id and wp_rmproductmanagement_order_details.status not in ('shipped','canceled'));"
  let [result2,err2] = await connection.execute(sql,[2,2])
  await Promise.all(result2.map(async (order) => {
    console.log(order)
    orderParts = order['orderid'].split(',')
    access_token = orderParts[2]
    orderID = orderParts[1]
    url = 'https://production.rutterapi.com/orders/'+orderID+'/fulfillments'
    payload = {
                'fulfillment':
                  {
                    'carrier':order['shipping_option_name'],
                    'tracking_number':order['tracking']
                }
              }
    let response = await axios({
        method: 'post',
        url: url,
        data:payload,
        params: {
            access_token: access_token
        },
        auth:{
          username:'6042cb5b-1d07-4c45-8eaf-c644c0c9581b',
          password: '46629b11-b78b-468b-9617-6985e21833c3'
        }
    })
    console.log(response)
    sql = 'update wp_rmproductmanagement_orders set rutterAdded=1 where order_id='+order['order_id']+';'
    let [result3,err3] = await connection.execute(sql,[2,2])
  }))
  res.send({msg:'success'})

})

/* GET home page. */
router.get('/test',async function(requ,res,next){
  connection = await getConnection()
  sql = 'select wp_usermeta.meta_value, wp_userfiles.fileName from wp_userfiles inner join wp_users_products_colors on wp_users_products_colors.image_id = wp_userfiles.fileId inner join wp_usermeta on wp_usermeta.user_id = wp_userfiles.userID where wp_usermeta.meta_key="cdn_alias" and wp_users_products_colors.sku = "1293881289-Orange-Medium";'
  let [result3,err3] = await connection.execute(sql,[2,2])
  console.log(result3)
  res.send({msg:'success'})
})
router.post('/', function(req, res, next) {
  payload = {
     "product": {
          "variants": [
               {
                    "option_values": [
                         {
                              "name": "Color",
                              "value": "red"
                         }
                    ],
                    "images": [
                         {
                              "src": "https://cdn1.vectorstock.com/i/1000x1000/10/30/isolated-red-tshirt-design-vector-33381030.jpg"
                         }
                    ],
                    "inventory": {
                         "total_count": 10
                    },
                    "weight": {
                         "unit": "g",
                         "value": 20
                    },
                    "sku": "red-tshirt1112",
                    "price": 10
               }
          ],
          "name": "Tshirt",
          "description": "tshirt",
          "status": "active"
     }
}
    axios({
        method: 'post',
        data:payload,
        url: ' https://production.rutterapi.com/products',
        params: {
            access_token: '17c228de-5b3c-427c-9acd-90a739dbe194'
        },
        auth:{
          username:'6042cb5b-1d07-4c45-8eaf-c644c0c9581b',
          password: '46629b11-b78b-468b-9617-6985e21833c3'
        }
      }).then(function(response){
        console.log(response['data'])
        res.send({msg:'success'})
      });

});

module.exports = router;
