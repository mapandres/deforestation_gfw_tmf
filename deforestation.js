//********************************************************************************************************************************************************
//*************** Deforestation analysis in the Pan Amazon region ****************************************************************************************
//********************************************************************************************************************************************************

// Author: Andrés Salazar (ajsalazar@uc.cl)


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 1) Initial settings
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//------------------------------------------------------------------------------------------------
// 1.1) Load assets

var roi = ee.FeatureCollection("projects/mapbiomas-raisg/DATOS_AUXILIARES/ESTADISTICAS/COLECCION4/country_per_biome");  

var gfc = ee.Image('UMD/hansen/global_forest_change_2021_v1_9')
          .clip(roi);

var mbpa = ee.Image("projects/mapbiomas-raisg/public/collection4/mapbiomas_raisg_panamazonia_collection4_integration_v1")
           .clip(roi);

var tmf_ac = ee.ImageCollection('projects/JRC/TMF/v1_2021/AnnualChanges')
                    .mosaic()
                    .select(ee.List.sequence(20, 30)) // Select bands corresponding to the period 2010-2020
                    .clip(roi);

var mbpa = ee.Image("projects/mapbiomas-raisg/public/collection4/mapbiomas_raisg_panamazonia_collection4_integration_v1")
        .select(ee.List.sequence(25, 35)) // Select bands corresponding to the period 2010-2020
        .clip(roi);

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 1.2) Other settings

// Center map in the ROI
Map.centerObject(roi, 4);

// Create a contour of the ROI
var roi_cont = ee.Image().toByte().paint({featureCollection: roi, width: 1.5});

//------------------------------------------------------------------------------------------------


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 2) Deforestation analysis - Global Forest Watch
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//------------------------------------------------------------------------------------------------
// 2.1) Prepare image

var ly = gfc.select(["lossyear"]); // select the band "loss year"

var ly_2010_2020 = ly.updateMask(
                             ly.gte(10).and(ly.lte(20)) // Select pixels corresponding to the period 2010-2020
                             );

var for_loss_gfw = gfc
                   .select("loss")
                   .updateMask(ly_2010_2020); // apply the mask to have only pixel correspoding to the period 2010-2020

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 2.2) Deforestation analysis

var get_def_gfw = function(feature) {
  var vals = for_loss_gfw.multiply(ee.Image.pixelArea()).reduceRegion({
    reducer: ee.Reducer.sum(), 
    geometry: feature.geometry(),
    scale: 30.92,
    maxPixels: 10e13,
  });
  
  var v = ee.Number(vals.get("loss"))
                    .divide(10000); // square meters to hectares
 
  var var_dict = {area_ha: v}; // values to a dictionary
  
  return ee.Feature(null, var_dict).copyProperties(feature, feature.propertyNames());
  
};

var def_gfw_data = roi
                  .map(get_def_gfw)
                  .map(function(f){return f.select(["name_es", "area_ha"])});

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 2.3) Chart deforestation area

print(ui.Chart.feature.byFeature({
          features: def_gfw_data.limit(5), // show the first 5 features (memory issues)
          xProperty: 'name_es'
        })
        .setChartType('ColumnChart')
        .setOptions({
          title: 'Deforestation (2010-2020) - Global Forest Watch \n (Only 5/18 biomes are represented here due to memory issues)',
          legend: {position: 'none'},
          hAxis:
              {
                title: 'Biome', 
                titleTextStyle: {italic: false, bold: true}
              },
          vAxis: {
            title: 'Area (ha)',
            titleTextStyle: {italic: false, bold: true}
          }
        }));

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 2.4) Export deforestation data to Google Drive

Export.table.toDrive({
  collection: def_gfw_data,
  description: "def_gfw_data",
  fileFormat: "CSV",
  fileNamePrefix: "def_gfw_data",
  folder: "GEE_deforestation",
  selectors: ["name_es", "area_ha"]});

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 2.5) Add deforestation image bewteen 2010-2020 to the map

Map.addLayer(for_loss_gfw, {palette: "blue"}, "Deforestation GFW");

//------------------------------------------------------------------------------------------------


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 3) Deforestation analysis - Tropical Moist Forest
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//------------------------------------------------------------------------------------------------
// 3.1) Prepare image

var for_loss_tmf = tmf_ac
            .updateMask(tmf_ac.eq(3)) // Select only deforested land
            .reduce(ee.Reducer.sum()); // Sum all the bands

var for_loss_tmf = for_loss_tmf.where(for_loss_tmf.gte(3), 1); // Transform all the pixel values to 1

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 3.2) Deforestation analysis

var get_def_tmf = function(feature) {
  var vals = for_loss_tmf.multiply(ee.Image.pixelArea()).reduceRegion({
    reducer: ee.Reducer.sum(), 
    geometry: feature.geometry(),
    scale: 30,
    maxPixels: 10e13,
  });
  
  var v = ee.Number(vals.get("sum"))
                    .divide(10000); // square meters to hectares
  
  var var_dict = {area_ha: v}; // values to a dictionary
  
  return ee.Feature(null, var_dict).copyProperties(feature, feature.propertyNames());
};

var def_tmf_data = roi
                  .map(get_def_tmf)
                  .map(function(f){return f.select(["name_es", "area_ha"])});
                  

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 3.3) Chart deforestation area

print(ui.Chart.feature.byFeature({
          features: def_tmf_data.limit(10), // show the first 10 features (memory issues)
          xProperty: 'name_es',
        })
        .setChartType('ColumnChart')
        .setOptions({
          title: 'Deforestation (2010-2020) - Tropical Moist Forest \n (Only 10/18 biomes are represented here due to memory issues)',
          legend: {position: 'none'},
          hAxis:
              {title: 'Biome', titleTextStyle: {italic: false, bold: true}},
          vAxis: {
            title: 'Area (ha)',
            titleTextStyle: {italic: false, bold: true}
          }
        }));

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 3.4) Export deforestation data to Google Drive

Export.table.toDrive({
  collection: def_tmf_data,
  description: "def_tmf_data",
  fileFormat: "CSV",
  fileNamePrefix: "def_tmf_data",
  folder: "GEE_deforestation",
  selectors: ["name_es", "area_ha"]});

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 3.5) Add deforestation image bewteen 2010-2020 to the map

Map.addLayer(for_loss_tmf, {palette: "yellow"}, "Deforestation TMF");

//------------------------------------------------------------------------------------------------


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 4) Agriculture analysis
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


//------------------------------------------------------------------------------------------------
// 4.1) Prepare image

var agri = mbpa.updateMask(
                           mbpa.eq(15).or(
                                          mbpa.gte(18).and(mbpa.lte(21))
                                          ) // select the classes correspoinding to agricultural activities
                        ).reduce(ee.Reducer.sum()); // Sum all the bands

var agri2 = agri
            .where(agri.gte(1), 1); // Transform all the pixel values to 1

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 4.2) Deforestation analysis

var agri_def = for_loss_tmf.add(agri2); // Sum forest loss with agriculture land (both have pixels values of 1)

var agri_def2 = agri_def.updateMask(agri_def.eq(2)); // Select only pixels with value 2

agri_def2 = agri_def2
            .where(agri_def2.gte(1), 1); // Transform all the pixel values to 1

var get_def_agri = function(feature) {
  var vals = agri_def2.multiply(ee.Image.pixelArea()).reduceRegion({
    reducer: ee.Reducer.sum(), 
    geometry: feature.geometry(),
    scale: 30,
    maxPixels: 10e13,
  });
  
  var v = ee.Number(vals.get("sum"))
                    .divide(10000); // square meters to hectares
  
  var var_dict = {area_ha: v}; // values to a dictionary
  
  return ee.Feature(null, var_dict).copyProperties(feature, feature.propertyNames());
};

var def_agri_data = roi
                    .map(get_def_agri)
                    .map(function(f){return f.select(["name_es", "area_ha"])});

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 4.3) Chart deforestation area due to agricultural activities 

print(ui.Chart.feature.byFeature({
          features: def_agri_data.limit(5), // show the first 5 features (memory issues)
          xProperty: 'name_es',
        })
        .setChartType('ColumnChart')
        .setOptions({
          title: 'Deforestation (2010-2020) due to agricultural activities - Tropical Moist Forest \n (Only 15/18 biomes are represented here due to memory issues)',
          legend: {position: 'none'},
          hAxis:
              {title: 'Biome', titleTextStyle: {italic: false, bold: true}},
          vAxis: {
            title: 'Area (ha)',
            titleTextStyle: {italic: false, bold: true}
          }
        }));

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 4.4) Export deforestation data to Google Drive

Export.table.toDrive({
  collection: def_agri_data,
  description: "def_agri_data",
  fileFormat: "CSV",
  fileNamePrefix: "def_agri_data",
  folder: "GEE_deforestation",
  selectors: ["name_es", "area_ha"]});

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 4.5) Add "deforestation due to agricultural activities" image bewteen 2010-2020 to the map

Map.addLayer(agri_def2, {palette: ["red"]}, "Agriculture - Deforestation", false);

//------------------------------------------------------------------------------------------------


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 5) Create a legend
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


//------------------------------------------------------------------------------------------------
// 5.1) Legend configuration

// Create the panel for the legend items.
var legend2 = ui.Panel({
  style: {
    position: 'top-right',
    padding: '8px 15px'
  }
});

// Create and add the legend title.
var legendTitle2 = ui.Label({
  value: 'Product',
  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
  }
});

legend2.add(legendTitle2);

var loading2 = ui.Label('Loading legend...', {margin: '2px 0 4px 0'});

legend2.add(loading2);


// Creates and styles 1 row of the legend.
var makeRow2 = function(color, name) {
  // Create the label that is actually the colored box.
  var colorBox2 = ui.Label({
    style: {
      backgroundColor: '' + color,
      // Use padding to give the box height and width.
      padding: '8px',
      margin: '0 0 4px 0'
    }
  });

  // Create the label filled with the description text.
  var description2 = ui.Label({
    value: name,
    style: {margin: '0 0 4px 6px'}
  });

  return ui.Panel({
    widgets: [colorBox2, description2],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};

// Get the list of palette colors and class names from the image.
var palette2 = ["blue", "yellow"];
var names2 = ["Global Forest Watch", "Tropical Moist Forest"];
loading2.style().set('shown', false);

for (var i = 0; i < names2.length; i++) {
    legend2.add(makeRow2(palette2[i], names2[i]));
  }

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 5.2) Add legend to the map

Map.add(legend2);

//------------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------------
// 5.3) Add ROI contour to the map

Map.addLayer(roi_cont, {palette: "black"}, "ROI");

//------------------------------------------------------------------------------------------------
