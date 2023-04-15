const sendEmail = require("../_helpers/send-email");
const db = require("../_helpers/db");
const moment = require("moment");
const puppeteer = require("puppeteer");
const path = require('path');
const { log } = require("console");
const parentDir = path.resolve(__dirname, '..');
const API_URL = "https://api.propelinspections.com/inventory/"
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
	const account = await db.Account.findByPk(params.user_id);
	if (!account) throw "User Account not found";
	const propertyInfo = {
		property_address: params.property_address,
		tenant_name: params.tenant_name,
		inspector_name: params.inspector_name,
		inspection_date: params.inspectiondate,
		ecp_exp_date: params.epc_expiry_date,
		ecir_exp_date: params.ecir_expirydate,
		gas_safety_certificate_exp_date: params.gas_safety_certificate_expiry_date,
		electricity_meter: params.electricity_meter,
		gas_meter: params.gas_meter,
		smoke_alarm: params.smoke_alarm,
		co_alarm: params.co_alarm,
		heating_system: params.heating_system,
		signature_inspector: params.signature_inspector,
		advised_tenant_to: params.advised_tenant_to,
		asked_landlord_to: params.asked_landlord_to,
		contractor_instructed: params.contractor_instructed,
		gas_meter_reading: params.gas_meter_reading,
		electricity_meter_reading: params.electricity_meter_reading,
		types: params.types,
		signature_tenant: params.signature_tenant,
		final_remarks: params.final_remarks,
		water_meter: params.water_meter,
		accountId: params.user_id,
		main_img: params.main_img,
		water_meter_reading: params.water_meter_reading,
		electricity_meter_img: params.electricity_meter_img,
		gas_meter_img: params.gas_meter_img,
		water_meter_img: params.water_meter_img,
		smoke_alarm_front_img: params.smoke_alarm_front_img,
		smoke_alarm_back_img: params.smoke_alarm_back_img,
		co_alarm_front_img: params.co_alarm_front_img,
		co_alarm_back_img: params.co_alarm_back_img,
		heating_system_img: params.heating_system_img,
	};

	const property = await new db.Property(propertyInfo);
	await property.save().then((res) => {
		if (property && property.id && property_details.length > 0) {
			property_details.map(async (property_de) => {
				const { images } = property_de;
				const propertyDetail = {
					propertyId: property.id,
					name: property_de.name,
					description: property_de.description,
					floor: property_de.floor,
					walls: property_de.walls,
                    doors:property_de.doors,
					ceiling: property_de.ceiling,
					windows: property_de.windows,
				};
				const property_detail = await new db.Property_details(propertyDetail);
				await property_detail.save().then((res) => {
					if (property_detail && property_detail.id && images.length > 0) {
						images.map(async (link) => {
							if (link !== null || link !== undefined || link !== "") {
								const propertyDetailImage = {
									propertyDetailId: property_detail.id,
									url: link,
								};
								const property_detail_image =
									await new db.Property_images(
										propertyDetailImage
									);
								await property_detail_image.save();
							}
						});
					}
				});
			});
		}
	});

	await sendPropertyEmail({
		account: account.dataValues,
		propertyInfo:propertyInfo,
		property_details:property_details,
		signature_inspector:params.signature_inspector,
		signature_tenant:params.signature_tenant
    }
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

async function sendPropertyEmail({account, propertyInfo, property_details, signature_inspector, signature_tenant}) {
    let message = `<!doctype html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>Inventory & Inspection</title>
    </head>
    <style>
    body {
        padding: 10px 0px;
        width: 90%;
        display: block;
        margin: auto;
        font-family: Arial, sans-serif;
    }
    
    .container {
        display: block;
        margin: auto;
    }
    
    .perei {
        display: block;
        margin: auto;
    }
    
    h3 {
        font-size: 22px;
        color: #000;
        margin: 10px 0px;
    }
    
    .questions {
        margin: 15px 0px;
        border: 2px solid #eee;
        padding: 10px 20px;
    }
    
    .questions h4 {
        font-size: 18px;
        color: #000;
        margin: 10px 0px;
    }
    
    p {
        margin: 0;
        font-size: 16px;
    }
    
    .header-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        border-radius: 10px;
    }
    
    .logo img {
        max-width: 200px;
        height: auto;
        margin: 0 20px 0 0;
    }
    
    .user-info {
        margin: 0 0 20px 0;
        margin-top: 10px;
    }
    
    @media (mi-width: 600px) {
        .header-container {
            flex-direction: row;
            align-items: left;
        }
    
        .logo {
            margin: 20px 0;
        }
    
        .user-info {
            margin: 0;
            text-align: left;
        }
    }
    
    .top-address {
        font-weight: 600;
        text-align: center;
        padding: 10px 0px;
        background-color: #0090ff;
        font-size: 16px;
        color: #fff;
        border-radius: 10px 10px 0px 0px;
        margin-bottom: 0px;
    }
    
    .bg-blue {
        background-color: #0a80ea;
        padding: 10px;
        margin: auto;
        color: #fff;
        font-weight: 300;
        text-align: center;
        width: 70%;
        display: block;
        margin: auto;
        border: 2px solid #013664;
        text-transform: uppercase;
        /* display: flex; */
        border-radius: 10px;
    }
    
    .propertyAddress {
        font-weight: 600;
        margin: 15px 0px;
        color: #000;
        text-align: center;
    }
    
    .propertyimg img {
        display: block;
        margin: auto;
        height: 400px;
        box-shadow: 1px 1px 19px 0px #b7b3b3;
        border-radius: 10px;
    }
    
    table {
        /* width: 70%; */
        max-width: "100%";
        margin: 0 auto;
        table-layout: fixed;
        margin-top: 20px;
    
        table-layout: auto;
        width: auto;
        /* Optional, to allow table to expand to fit its parent container */
        border-collapse: collapse;
    }
    
    th,
    td {
        text-align: left;
        padding: 8px;
        border: 1px solid #ddd;
    }
    
    th {
        background-color: #0a80ea;
        color: white;
    }
    
    tr:nth-child(even) {
        /* background-color: #f2f2f2; */
    }
    
    .summary {
        /* width: 80%; */
        display: block;
        margin: auto
    }
    
    .summaryHeading {
        font-weight: 600;
        color: #0a80ea;
        text-align: left;
        /* margin-left: 20px; */
        font-size: 22px;
    }
    
    .summary p {
        border: 1px solid #ddd;
        padding: 15px;
        border-radius: 10px;
        margin: 10px 0px;
        font-size: 16px;
    }
    
    .questions {
        margin: 15px 0px;
    }
    
    .parent {
        display: flex;
        /* margin: 20px 0; */
    }
    
    .card {
        width: 45%;
        border: 2px solid #eee;
        margin: 10px;
        border-radius: 10px;
        padding: 20px
    }
    
    .cell1 {
        max-width: "20%";
    }
    
    .card3 {
        width: 48%;
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
        font-size: 14px;
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
    
    .meterInfo {
        font-size: 18px;
    }
    
    .rooms {
        font-size: 18px;
        font-weight: 500;
    }
    
    .follwg ol li {
        font-size: 16px;
        margin-bottom: 10px;
    }
    
    .imgRoom {
        margin-bottom: 10px;
        padding-right: 10px;
    }
    
    .table22 {
        width: "100%";
    }
    
    .image-grid {
        /* display: flex; */
        flex-wrap: wrap;
        flex-direction: "row";
        justify-content: space-between;
    }
    
    .room {
        margin-bottom: 10px;
    }
    
    .tennat {
        padding-top: 10px
    }
    
    .tennat h3 {
        font-size: 20px
    }
    
    .tennat p {
        border-bottom: 2px solid #333;
        font-size: 18px;
        padding-bottom: 10px;
        width: 100%;
    
    }
    
    .text-center {
        padding: 20px 0px;
        text-align: center;
    }
    
    .text-center .blue {
        text-align: center;
        /* font-size: 24px; */
        padding-bottom: 0px;
        margin-bottom: 5px;
    }
    
    .text-center p {
        font-size: 17px;
    }
    
    .d-flex {
        display: flex;
        justify-content: space-around;
    }
    
    .divone {
        border: 3px solid #0090ff;
        padding: 15px;
        width: 50%;
        height: 460px;
        margin: 0px 20px;
        border-radius: 10px;
    }
    
    .blue {
        text-align: left;
        color: #0090ff;
      
        font-size: 16px;
        padding: 0px 0px
    }
    
    .textc {
        text-align: center;
    }
    
    .blue1 {
        color: #0090ff;
        font-weight: 600;
        font-size: 14px;
        padding-right: 10px;
        width:100px;
    }
    
    .blacktext {
        color: #000;
        font-weight: 600;
        font-size: 14px;
    }
    </style>
    <body>
        <section class="ptb" style="display: block; margin: auto">
            <div class="header-container">
                <div class="logo">
                    <img src="${API_URL}${account.company_logo}" alt="Logo">
                </div>
                <div class="user-info">
                    <span style="width:100px" class="blue1"><b>Company Name:</b></span>
                    <span>${account.company_name}</span><br>
                    <span style="width:100px" class="blue1"><b>Address:</b></span>
                    <span>${account.company_address}</span><br>
                    <span class="blue1"><b>Phone:</b></span>
                    <span>${account.mobile_number}<br>
                    <span class="blue1"><b>Email:</b></span>
                    <span> ${account.company_email}</span>
                </div>
            </div>
            <h1 class="bg-blue">${propertyInfo.types}</h1>
            <h2 class="propertyAddress">${propertyInfo.property_address}s</h2>
            <div class="propertyimg">
            ${propertyInfo.main_img != '' && propertyInfo.main_img != null ?  
              `<img src="${API_URL}${propertyInfo.main_img}" alt="property Image">`:``}
            </div>
        <div class="firsttable">
        <table>
            <tbody>
                <tr>
                  <td style="font-weight: bold;">Inspected By</td>
                  <td style="width: 340px;">${propertyInfo.inspector_name}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Tenant’s Name</td>
                  <td>${propertyInfo.tenant_name}</td>
                </tr>
                
                <tr>
                  <td style="font-weight: bold;">Date of Inspection</td>
                  <td>${moment(propertyInfo.inspection_date).format('DD-MMM-YYYY')}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">EPC Expiry Date</td>
                  <td>${moment(propertyInfo.ecp_exp_date).format('DD-MMM-YYYY')}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Gas Safety Certificate Expiry Date</td>
                    <td>${moment(propertyInfo.gas_safety_certificate_exp_date).format('DD-MMM-YYYY')}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">EICR Expiry Date</td>
                    <td>${moment(propertyInfo.ecir_exp_date).format('DD-MMM-YYYY')}</td>
                </tr>
              
            </tbody>
        </table>
    </div> 
      <div class="summary">
            <h3 class="summaryHeading">
                Summary
            </h3>
            <p>${propertyInfo.final_remarks}</p>
        </div>
    </section>
    <section id="ptb">
      <div class="container">
       
          
          <div class="questions">
          <h3 class="blue">
              Important Information
          </h3>
            <h4>What is an Inventory Check-In Report? </h4>
            <p>The Inventory Check-In Report provides a fair, objective and impartial record of the general
                condition of the contents of the Property as well as its internal condition at the outset of the
                lease of the Property.
            </p>
            <h4>What are the benefits of using this Report? </h4>
            <p>The importance of a professional inventory and statement of condition cannot be underestimated.
                Government advice indicates that Inventories and statements of condition are 'strongly
                recommended' as a means to reduce dispute about the deposit at the end of a tenancy. It is in
                the Tenant's interests to carefully check this Inventory Check-In Report and to highlight any
                discrepancies as soon as possible and in any event no later than five working days after this
                Inventory Check-In Report is completed. Any outstanding discrepancies found at the end of the
                tenancy will be highlighted in an Inventory Outgoing Report and may affect the retention or
                release of a tenancy deposit.
            </p>
            <h4>Is the report aimed at the landlord or the tenant? </h4>
            <p>The Inventory Check-In Report is objective and contains photographic evidence, it may be relied
                upon and used by the Landlord, the Tenant and Letting Agent.
            </p>
            <h4>What does this Report tell you? </h4>
            <p>The Inventory Check-In Report provides a clear and easy to follow statement of condition for each
                of the main elements of the property on a room by room basis, together with its contents if
                appropriate. This report comments on and highlights defects or aspects of poor condition that
                have been identified by the Inventory Clerk. Defects in condition will either be described in
                the narrative of the report or evidenced in the photographs included in the report. Please Note:
                where no comment on the condition of an element or item of contents is made by the Inventory
                Clerk, the element or item is taken to be in good condition and without defect.
            </p>
            <h4>What does the report not tell you? </h4>
            <p>Whilst every effort is made to ensure objectivity and accuracy, the Inventory Check-In Report
                provides no guarantee of the adequacy, compliance with standards or safety of any contents or
                equipment. The report will provide a record that such items exist in the property as at the date
                of the Inventory Check-In Report and the superficial condition of same. The report is not a
                building survey, a structural survey or a valuation, will not necessarily mention structural
                defects and does not give any advice on the cost of any repair work, or the types of repair
                which should be used.
            </p>
            <h4>What is inspected and not inspected? </h4>
            <p>The Inventory Clerk carries out a visual inspection of the inside of the main building together
                with any contents and will carry out a general inspection of the remainder of the building
                including the exterior cosmetic elements and any permanent outbuildings. For properties let on
                an unfurnished basis, the inspection will include floor coverings, curtains, curtain tracks,
                blinds and kitchen appliances if appropriate, but will exclude other contents. Gardens and their
                contents will be inspected and reported upon. The inspection is non-invasive. The means that the
                Inventory Clerk does not take up carpets, floor coverings or floor boards, move large items of
                furniture, test services, remove secured panels or undo electrical fittings. Especially valuable
                contents such as antiques, personal items or items of jewellery are excluded from the report.
                Kitchenware will be inspected but individual items will not be condition rated. Common parts in
                relation to flats, exterior structural elements of the main building and the structure of any
                outbuildings will not be inspected. Roof spaces and cellars are not inspected. Areas which are
                locked or where full access is not possible, for example, attics or excessively full cupboards
                or outbuildings are not inspected.
            </p>
    
            <h4>What is a Mid-Term Inspection Report? </h4>
            <p>The Mid-Term Inspection Report provides a fair, objective and impartial record of the general
                condition of the contents of the Property as well as its internal condition during the lease of
                the Property. Any defects and maintenance issues noted during the inspection are highlighted in
                the report. The tenants are required to rectify the issues which come under their obligations as
                per the terms & conditions of the tenancy agreement. Similarly, the landlord of the property
                will be asked to deal with the maintenance issues accordingly.
            </p>
    
            <h4>What is a Check-Out Report? </h4>
            <p>The Check-Out Report provides a fair, objective and impartial record of the general condition of
                the contents of the Property as well as its internal condition at the end of the lease of the
                Property. Normally, the return of the tenancy deposit is based on the outcome of the Check-Out
                report.
            </p>
          </div>
       
      </div>
    </section>
    <section id="ptb">
        <div class="container">
            <h3 class="blue">Metres and Alarms</h3>
            <div class="parent">
                <div class="card">
                    <div class="card-header">
                        <div class="col-1"> 
                          <span class="gas">Pre-Paid Gas Meter:</span> 
                          <span  style="color:#000000" class="gas">${propertyInfo.gas_meter}</span> 
                        </div>
                        <div class="col-1"> 
                          <span class="gas">Reading:</span> 
                          <span style="color:#000000" class="gas">${propertyInfo.gas_meter_reading}</span>
                        </div>
                    </div>
                    ${propertyInfo.gas_meter_img != null && propertyInfo.gas_meter_img != "" ?`<div class="gas-img"> 
                      <img src="${API_URL}${propertyInfo.gas_meter_img}" width="100%" height="auto"> 
                    </div>`:``}
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="col-1"> 
                          <span class="gas">Pre-Paid Electricity Meter:</span> 
                          <span  style="color:#000000" class="gas">${propertyInfo.electricity_meter}</span>
                        </div>
                        <div class="col-1">
                          <span class="gas">Reading:</span>
                          <span style="color:#000000" class="gas">${propertyInfo.electricity_meter_reading}</span>
                        </div>
                    </div>
                   ${propertyInfo.electricity_meter_img != null && propertyInfo.electricity_meter_img != "" ? 
                    `<div class="gas-img"> 
                      <img src="${API_URL}${propertyInfo.electricity_meter_img}" width="100%" height="auto"> 
                    </div>`:``}
                </div>
    
                
            </div>
            <div class="parent">
                <div class="card">
                    <div class="card-header">
                        <div class="col-1"> 
                          <span class="gas">Heating System:</span> 
                          <span style="color:#000000" class="gas">${propertyInfo.heating_system}</span>
                        </div>
                    </div>
                    ${propertyInfo.heating_system_img != "" && propertyInfo.heating_system_img != null ? 
                    `<div class="gas-img">
                      <img src="${API_URL}${propertyInfo.heating_system_img}" width="100%" height="auto">
                    </div>`:``}
                </div>
    
    
                <div class="card">
                    <div class="card-header">
                        <div class="col-1"> 
                          <span class="gas">Water Meter:</span> 
                          <span  style="color:#000000" class="gas">${propertyInfo.water_meter}</span> 
                        </div>
                        <div class="col-1"> 
                          <span class="gas">Reading:</span> 
                          <span  style="color:#000000" class="gas">${propertyInfo.water_meter_reading}</span>
                        </div>
                    </div>
                   ${propertyInfo.water_meter_img != "" && propertyInfo.water_meter_img != null ? `<div class="gas-img">
                      <img src="${API_URL}${propertyInfo.water_meter_img}" width="100%" height="auto">
                    </div>`:``}
                </div> 
            </div>
            <div class="parent">
    
                <div class="card3">
                    <div class="card-header">
                        <div class="col-1"> 
                          <span class="gas">Smoke Alarm:</span> 
                          <span style="color:#000000" class="gas">${propertyInfo.smoke_alarm}</span>
                        </div>
                    </div>
                    <div class="image-grid"> 
                      ${propertyInfo.smoke_alarm_front_img != "" && propertyInfo.smoke_alarm_front_img != null ?`<img src="${API_URL}${propertyInfo.smoke_alarm_front_img}" style="margin-top: 10px;" width="48%" height="auto" />`:``}  
                      ${propertyInfo.smoke_alarm_back_img != "" && propertyInfo.smoke_alarm_back_img != null ?`<img src="${API_URL}${propertyInfo.smoke_alarm_back_img}"   style="margin-top: 10px;" width="48%" height="auto" />`:``}
                    </div>
                </div>
    
                <div class="card3">
                    <div class="card-header">
                        <div class="col-1">
                          <span class="gas">CO Alarm:</span>
                          <span style="color:#000000" class="gas">${propertyInfo.co_alarm}</span>
                        </div>
                    </div>
                    <div class="image-grid"> 
                    ${propertyInfo.co_alarm_front_img != "" && propertyInfo.co_alarm_front_img != null ? `<img src="${API_URL}${propertyInfo.co_alarm_front_img}"  style="margin-top: 10px;" width="48%" height="auto" />`:``}
                    ${propertyInfo.co_alarm_back_img != "" && propertyInfo.co_alarm_back_img != null ?  `<img src="${API_URL}${propertyInfo.co_alarm_back_img}"   style="margin-top: 10px;" width="48%" height="auto" />`:``}
                    </div>
                </div>
            </div>
        </div>
    </section>
    
      <section class="top-margin">
       ${property_details.map((item, index) => {
         return `<div class="">   
         <div class="room">
             <h3 class="blue">${item.name}</h3>
             <table class="table22"  style="width:100%; margin-bottom:10px ">
                 <thead>
                     <tr>
                         <th style="width: 100px;">Description</th>
                         <th>Details</th>
                     </tr>
                 </thead>
                 <tbody>
                     <tr>
                     ${item.name == "Rear Garden" ? 
                        `<td style="font-weight: bold;">Lawn</td>` : 
                        `<td style="font-weight: bold;">Floor</td>`
                      }
                     
                         <td>${item.floor}</td>
                     </tr>
                     <tr>
                         <td style="font-weight: bold;">Walls</td>
                         <td>${item.walls}</td>
                     </tr>
                     <tr>
                        ${item.name == "Kitchen" ? 
                        `<td style="font-weight: bold;">Appliances</td>` : 
                        item.name == "Rear Garden" ?
                        `<td style="font-weight: bold;">Fence</td>` :
                        `<td style="font-weight: bold;">Ceiling</td>`
                      }
                         <td>${item.ceiling}</td>
                     </tr>
                     <tr>
                         <td style="font-weight: bold;">Windows</td>
                         <td>${item.windows}</td>
                     </tr>
                    
                     <tr>
                      <td style="font-weight: bold;">Doors</td>
                      <td>${item.doors}</td>
                     <tr>
                      <td style="font-weight: bold;">Description</td>
                      <td>${item.description}</td>
                 </tr>
                 </tr>
                 </tbody>
             </table>
         </div>
         <div class="image-grid">
            ${item.images.map((img, index) => {
                return `<img src="${API_URL}${img}" class="imgRoom" width="31.6%" height="auto" />`;
            }).join("")}
         </div>
     </div>`
       }).join("")} 
      </section>  
      <section>
      <div class="tennat">
          <h3 style="color: #0090ff">Advice For Tenant:</h3>
          <p>${propertyInfo.advised_tenant_to}</p>
      </div>
      <div class="tennat">
          <h3 style="color: #0090ff">Advice For Landlord:</h3>
          <p>${propertyInfo.asked_landlord_to}</p>
      </div>
    </section>
    <section>
        <div class="text-center">
            <h4 class="blue">Declaration</h4>
            <p>This inventory provides a record of the contents of the property and the property’s internal condition. The person preparing the inventory is not an expert in fabrics, wood, materials, antiques etc nor a qualified surveyor. The inventory should not be used as an accurate description of each piece of furniture and equipment. Any areas of dilapidation or defect at the commencement of the tenancy need to be reported to the landlord/agency within 7 days of the commencement of tenancy. All items and areas listed in the property are in good, clean, serviceable condition unless otherwise stated.</p>
        </div>
    </section>
    
    <section>
        <div class="d-flex">
            <div class="divone">
                <h3 class="textc">Tenant’s Signature</h3>
                <img  style="margin-top: 10px;" width="100%" height="400px" src="${signature_tenant}" alt="" />
            </div>
            <div class="divone">
                <h3 class="textc">Inspector’s Signature</h3>
                <img  style="margin-top: 10px;" width="100%" height="400px" src="${signature_inspector}" alt="" />
            </div>
        </div>
    </section>
    </body>
    </html>`;

 (async () => {
 const browser = await puppeteer.launch({
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--disable-web-security',
    ]
  });
  const page = await browser.newPage();
  await page.setContent(message, {
    waitUntil:"load",
    printBackground: true,
  });
  await page.addStyleTag({
    content:  `* { page-break-inside: avoid; }`,
  });
  var name = `${account.firstName}${moment().unix()}.pdf`
  const screenshotPath = path.join(parentDir, 'uploads',name);
  
  await page.pdf({
    path: screenshotPath,
    margin: { top: '20px', right: '10px', bottom: '10px', left: '10px' },
    printBackground: true,
    format: 'A4',
  });
  await sendEmail({
    to: account.email,
    subject: "Property Detail Reports",
    html: `You can download details report of the property from the following link , <a href="https://api.propelinspections.com/uploads/${name}">Download Report</a>`,
  });
//   // close the browser
await browser.close();
})();
}
