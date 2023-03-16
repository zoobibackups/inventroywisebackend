const fs = require("fs");
const sendEmail = require("../_helpers/send-email");
const db = require("../_helpers/db");
const moment = require("moment");
const path = require('path');
const parentDir = path.resolve(__dirname, '..');
const puppeteer = require("puppeteer");
module.exports = {
	getAll,
	getById,
	create,
	update,
	delete: _delete,
	getByUserId,
};

async function getAll() {
	let properties = await db.Property.findAndCountAll({
		distinct: true,
		include: [
			{
				model: db.Property_details,
				as: "property_details",
				include: [
					{
						model: db.Property_images,
						as: "property_images",
					},
				],
			},
		],
	});
	const { rows, count } = properties;
	const final_properties = rows.map(async (property) => {
		property["signature_inspector"] = Buffer.from(property.signature_inspector, "binary").toString(
			"base64"
		);
		property["signature_tenant"] = Buffer.from(property.signature_tenant, "binary").toString("base64");
		return property;
	});

	properties = {
		count: count,
		rows: await Promise.all(final_properties),
	};

	return properties;
}

async function getById(id) {
	const property = await getProperty(id);
	return property;
}

async function getByUserId(id) {
	const properties = await db.Property.findAndCountAll({
		where: { accountId: id },
		distinct: true,
		include: [
			{
				model: db.Property_details,
				as: "property_details",
				include: [
					{
						model: db.Property_images,
						as: "property_images",
					},
				],
			},
		],
	});

	return properties;
}

async function create(params) {
	const { property_details } = params;
	const account = await db.Account.findByPk(params?.user_id);
	if (!account) throw "User Account not found";
	const propertyInfo = {
		property_address: params?.property_address,
		tenant_name: params?.tenant_name,
		inspector_name: params?.inspector_name,
		inspection_date: params?.inspectiondate,
		ecp_exp_date: params?.epc_expiry_date,
		ecir_exp_date: params?.ecir_expirydate,
		gas_safety_certificate_exp_date: params?.gas_safety_certificate_expiry_date,
		electricity_meter: params?.electricity_meter,
		gas_meter: params?.gas_meter,
		smoke_alarm: params?.smoke_alarm,
		co_alarm: params?.co_alarm,
		heating_system: params?.heating_system,
		signature_inspector: params?.signature_inspector,
		advised_tenant_to: params?.advised_tenant_to,
		asked_landlord_to: params?.asked_landlord_to,
		contractor_instructed: params.contractor_instructed,
		gas_meter_reading: params?.gas_meter_reading,
		electricity_meter_reading: params?.electricity_meter_reading,
		types: params?.types,
		signature_tenant: params?.signature_tenant,
		final_remarks: params?.final_remarks,
		water_meter: params?.water_meter,
		accountId: params?.user_id,
		main_img: params?.main_img,
		water_meter_reading: params?.water_meter_reading,
		electricity_meter_img: params?.electricity_meter_img,
		gas_meter_img: params?.gas_meter_img,
		water_meter_img: params?.water_meter_img,
		smoke_alarm_front_img: params?.smoke_alarm_front_img,
		smoke_alarm_back_img: params?.smoke_alarm_back_img,
		co_alarm_front_img: params?.co_alarm_front_img,
		co_alarm_back_img: params?.co_alarm_back_img,
		heating_system_img: params?.heating_system_img,
	};

	const property = await new db.Property(propertyInfo);
	await property.save().then((res) => {
		if (property && property.id && property_details.length > 0) {
			property_details.map(async (property_de) => {
				const { images } = property_de;
				const propertyDetail = {
					propertyId: property.id,
					name: property_de?.name,
					description: property_de?.description,
					floor: property_de?.floor,
					walls: property_de?.walls,
					ceiling: property_de?.ceiling,
					windows: property_de?.windows,
				};
				const property_detail = await new db.Property_details(propertyDetail);
				await property_detail.save().then((res) => {
					if (property_detail && property_detail.id && images.length > 0) {
						images.map(async (link) => {
							const propertyDetailImage = {
								propertyDetailId: property_detail.id,
								url: link,
							};
							const property_detail_image = await new db.Property_images(
								propertyDetailImage
							);
							await property_detail_image.save();
						});
					}
				});
			});
		}
	});

	await sendPropertyEmail(
		account,
		propertyInfo,
		property_details,
		params.signature_inspector,
		params.signature_tenant
	);

	return property;
}

async function update(id, params) {
	await _delete(id);
	const property = await create(params);
	return property;
}

async function _delete(id) {
	const property = await getProperty(id);
	const { property_details } = property;
	if (property && property.property_details.length > 0) {
		property_details.map(async (propertyDetail) => {
			const { property_images } = propertyDetail;
			if (propertyDetail && property_images.length > 0) {
				await db.Property_images.destroy({ where: { propertyDetailId: propertyDetail.id } });
			}
		});
	}
	await db.Property_details.destroy({ where: { propertyId: property.id } });
	await property.destroy();
}

// helper functions

async function getProperty(id) {
	const property = await db.Property.findOne({
		where: { id: id },
		include: [
			{
				model: db.Property_details,
				as: "property_details",
				include: [
					{
						model: db.Property_images,
						as: "property_images",
					},
				],
			},
		],
	});
	if (!property) throw "Property not found";
	return property;
}

async function sendPropertyEmail(account, propertyInfo, property_details, signature_inspector, signature_tenant) {
	const message = `<!DOCTYPE html>
    <html>
    
    <head>
      <meta charset="UTF-8">
      <title>Report Title</title>
    </head>
    <style>
      body {
        width: 90%;
        display: block;
        margin: auto;
        background-color: #fff;
        border: 2px solid #0090ff;
        padding: 20px;
        border-radius: 10px;
      }
    
      .header-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        /* padding: 40px auto; */
        background-color: #0090ff1a;
        padding: 20px;
        border-radius: 10px;
        /* border: 2px solid #0090ff; */
      }
    
      .logo img {
        max-width: 200px;
        height: auto;
        margin: 0 20px 0 0;
      }
    
      .user-info {
        margin: 0 0 20px 0;
        margin-top: 20px;
      }
    
      @media (max-width: 600px) {
        .header-container {
          flex-direction: column;
          align-items: center;
        }
    
        .logo {
          margin: 10px 0;
        }
    
        .user-info {
          margin: 0;
          text-align: center;
        }
      }
    
      .top-address {
        font-weight: 600;
        text-align: center;
        padding: 10px 0px;
        background-color: #0090ff;
        font-size: 20px;
        color: #fff;
        border-radius: 10px 10px 0px 0px;
        margin-bottom: 0px;
      }
    
      .property-img {
        display: block;
        margin: auto;
        width: 100%;
        height: 200px;
        border-radius: 0px 0px 10px 10px;
      }
    
     
    
      table {
        border-collapse: collapse;
        width: 98.5%;
        margin: 20px 10px;
      }
    
      th
      td {
        padding: 12px;
        text-align: left;
      }
    
      thead {
        background-color: #333;
        color: #fff;
      }
    
      tbody tr:nth-child(even) {
        background-color: #f1f1f1;
      }
    
      tbody tr:hover {
        background-color: #ddd;
      }
    
      td {
        border: 1px solid #ddd;
      }
    
      th {
        border: 1px solid #333;
      }
    
      .parent {
        display: flex;
       
        /* margin: 20px 0; */
      }
    
      .card {
        width: 33%;
        border: 2px solid #eee;
        margin: 10px;
        border-radius: 10px;
        padding: 20px
      }
    
      .card1 {
        width: 50%;
        border: 2px solid #eee;
        margin: 10px;
        border-radius: 10px;
        padding: 20px
      }
    
      .card2 {
        /* width: 50%; */
        border: 2px solid #eee;
        margin: 10px;
        border-radius: 10px;
        padding: 20px
      }
    
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        padding-bottom: 10px;
        border-bottom: 1px solid #0090ff;
      }
    
      .gas {
        color: #0090ff;
        font-weight: 600;
      }
    
      .gas-img img {
        margin-top: 10px;
        border-radius: 10px;
      }
    
      .gas-img2 {
        display: flex;
      }
    
      .gas-img2 img {
        margin: 10px;
        border-radius: 10px;
      }
    .body{
      display: flex;
      justify-content: flex-end;
    }
      .body .right {
        padding: 10px;
        margin: 10px;
      }
    
    
      .blue {
        color: #0090ff;
        font-weight: 600;
        font-size: 18px;
        padding-right: 10px;
      }
      .blue2 {
        color: #0090ff;
        font-weight: 600;
        font-size: 22px;
        margin-bottom: 0px;
      }
    
      .h1 {
        font-weight: bold;
        font-size: 1.2em;
        background-color: white;
        color: #0090ff;
      }
    
      .signatre {
        width: 100px;
        height: auto;
        /* align-self: flex-end */
      }
      .blue3{
        color: #0090ff;
        /* width: 100%; */
      }
    </style>
    
    <body>
      <header>
        <div class="header-container">
          <div class="logo"> 
          <img
              src="https://api.propelinspections.com/uploads/pdf_logo.jpg"
              alt="Logo"> </div>
        
        </div>
      </header>
      <section>
        <p class="top-address">${propertyInfo?.property_address}</p> 
          <img class="property-img" src="https://api.propelinspections.com/${propertyInfo?.main_img}"
          alt="property image" />
      </section>
      <section class="top-margin">
        <div>
          <table>
            <tr>
              <td class="blue3">ECIR Expiry Date:</td>
              <td>${propertyInfo?.ecir_exp_date}</td>
              <td class="blue3">Gas Safety Certificate Expiry Date:</td>
              <td>${propertyInfo.gas_safety_certificate_exp_date}</td>
              <td class="blue3">Inspection Date:</td>
              <td>${propertyInfo?.inspection_date}</td>
              
            </tr>
            <tr>
              <td class="blue3">EPC Expiry Date:</td>
              <td>${propertyInfo?.ecp_exp_date}</td>
              <td class="blue3">Tenant Name:</td>
              <td>${propertyInfo?.tenant_name}</td>
              <td class="blue3">Inspector Name:</td>
              <td>${propertyInfo?.inspector_name}</td>
            </tr>
            <tr>
              <td class="blue3">Advised Tenant To:</td>
              <td>${propertyInfo?.advised_tenant_to}</td>
              <td class="blue3">Contractor Instructed:</td>
              <td>${propertyInfo?.contractor_instructed}</td>
              <td class="blue3">Asked Landlord To:</td>
              <td>${propertyInfo?.asked_landlord_to}</td>
             
            </tr>
          </table>
        </div>
      </section>
      <section class="top-margin" id="cards">
        <div class="parent">
          <div class="card">
            <div class="card-header">
              <div class="col-1"> <span class="gas">Gas Meter:</span> <span class="gas">Yes</span> </div>
              <div class="col-1"> <span class="gas">Reading:</span> <span class="gas">${
			propertyInfo.gas_meter_reading
		}</span> </div>
            </div>
            <div class="gas-img">
             <img 
             src="https://api.propelinspections.com/${propertyInfo?.gas_meter_img}" width="100%" height="auto">
              </div>
          </div>
          <div class="card">
            <div class="card-header">
              <div class="col-1"> <span class="gas">Electricity Meter:</span> <span class="gas">${
			propertyInfo.electricity_meter
		}</span> </div>
              <div class="col-1"> <span class="gas">Reading:</span> <span class="gas">${
			propertyInfo.electricity_meter_reading
		}</span> </div>
            </div>
            <div class="gas-img"> <img src="https://api.propelinspections.com/${
			propertyInfo?.electricity_meter_img
		}" width="100%" height="auto"> </div>
          </div>
          <div class="card">
            <div class="card-header">
              <div class="col-1"> <span class="gas">Water Meter:</span> <span class="gas">${
			propertyInfo.water_meter
		}</span> </div>
              <div class="col-1"> <span class="gas">Reading:</span> <span class="gas">${
			propertyInfo.water_meter_reading
		}</span> </div>
            </div>
            <div class="gas-img"> <img src="https://api.propelinspections.com/${
			propertyInfo?.water_meter_img
		}" width="100%" height="auto"> </div>
          </div>
          <div class="card">
            <div class="card-header">
              <div class="col-1"> <span class="gas">Heating System:</span> <span class="gas"></span> </div>
              <div class="col-1"> <span class="gas">Reading:</span> <span class="gas">Yes</span> </div>
            </div>
            <div class="gas-img">
             <img src="https://api.propelinspections.com/${
			propertyInfo?.heating_system_img
		}" width="100%" height="auto"> </div>
          </div>
        </div>
      </section>
      <section class="top-margin">
        <div class="parent">
          <div class="card1">
            <div class="card-header">
              <div class="col-1"> <span class="gas">Smoke Alarm:</span> <span class="gas">${
			propertyInfo.smoke_alarm
		}</span> </div>
            </div>
            <div class="gas-img2"> 
                <img src="https://api.propelinspections.com/${
			propertyInfo?.smoke_alarm_front_img
		}" width="48%" height="auto"> 
              <img src="https://api.propelinspections.com/${propertyInfo?.smoke_alarm_back_img}"
                width="48%" height="auto" /> </div>
          </div>
          <div class="card1">
            <div class="card-header">
              <div class="col-1"> <span class="gas">CO Alarm:</span> <span class="gas">${
			propertyInfo.co_alarm
		}</span> </div>
            </div>
            <div class="gas-img2"> 
              <img src="https://api.propelinspections.com/${
			propertyInfo?.co_alarm_front_img
		}" width="48%" height="auto"> 
              <img src="https://api.propelinspections.com/${propertyInfo?.co_alarm_back_img}"
                width="48%" height="auto" /> </div>
          </div>
        </div>
       
      </section>
      <section class="top-margin">
       ${property_details.map((item, index) => {
		      return `
            <div class="card2">
              <div class="card-header">
                <div class="col-1">
                  <span class="blue2">${item.name}</span>
                  <p class="room-para">
                  ${item.description}
                  </p>
                </div>
              </div>
              <div class="gas-img2"> 
                  ${item?.images?.map((img, index) => {
		                return `<img src="https://api.propelinspections.com/${img}" width="31.5%" height="auto" />`
	                })}
              </div>
            </div>`
          })
      }    
      </section>
    
      <section>
        <div class="body">
          <div class="right" style="background-color: #fff">
            <h1 class="h1">Tenant Name</h1>
            <h4>${propertyInfo.tenant_name}</h4> 
            <img class="signatre" src="${signature_tenant}" alt="" />
          </div>
          <div class="right" style="background-color: #fff"></div>
          <div class="right" style="background-color: #fff">
            <h1 class="h1">Inspector Name</h1>
            <h4>${propertyInfo.inspector_name}</h4> 
            <img class="signatre" src="${signature_inspector}" alt="" />
          </div>
        </div>
      </section>
    </body>
    
    </html>`.replace(/,/g,"");

	(async () => {
		// launch a new chrome instance
		const browser = await puppeteer.launch({
			headless: true,
		});

		// create a new page
		const page = await browser.newPage();

		// set your html as the pages content

		await page.setContent(message, {
			waitUntil: "load",
			printBackground: true,
		});
		await page.addStyleTag({
			content: "* { page-break-inside: avoid; }",
		});
    var name = `${moment().unix()}.pdf`
    const screenshotPath = path.join(parentDir, 'uploads',name);
		await page.pdf({
			format: "A4",
			path: screenshotPath,
		});
    await sendEmail({
      to: "engr.aftabufaq@gmail.com",
      subject: "Property Detail Reports",
      html: `You can download details report of the property from the following link , https://api.propelinspections.com/uploads/${name}`,
    });
		// close the browser
		await browser.close();
	})();
}
