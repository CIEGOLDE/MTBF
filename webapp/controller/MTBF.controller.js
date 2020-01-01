sap.ui.define([
	"./BaseController",
	"./designMode",
	"./messages",
	"sap/ui/model/json/JSONModel",
	"sap/ui/export/Spreadsheet",
	"sap/ui/model/Filter",
	"sap/m/Token",
	"cie/MTBF/util/echarts",	
	"sap/ui/model/FilterOperator",	
	"sap/m/MessageToast"	
], function (BaseController,designMode,messages,JSONModel,Spreadsheet,Filter,Token,echartsjs,FilterOperator,MessageToast) {
	"use strict";

	return BaseController.extend("cie.MTBF.controller.MTBF", {
		onInit: function () {
			this.getView().addStyleClass("sapUiSizeCompact");
			this._ResourceBundle = this.getModel( "i18n" ).getResourceBundle();			
			this._JSONModel = new JSONModel();
			this.setModel(this._JSONModel);		
			this.initDateRange();			
			this.getInitData();				
		},
		onAfterRendering: function() {
			this.initLocationF4Help();
		},		
		
		//******************************************************************************//				
		// init Date Range
		initDateRange: function () {
			var date = new Date();
			this.byId("downDate").setTo(date);
			var year = date.getFullYear();
			var nowMonth = date.getMonth() + 1;
			nowMonth = (nowMonth < 10 ? "0" + nowMonth : nowMonth);
			var dateStr = year.toString() + '-' + nowMonth.toString() + '-' + '01';
			this.byId("downDate").setFrom(new Date(dateStr));
		},		
		// init Data
		getInitData: function(){
			var mtbflist = {
				equipment: "",
				yearMonth: "",
				downTime: "",
				frenquency:"",
				productionTime:"",
				target:""
			};
			var mtbflistSet = [];
			this._JSONModel.setProperty("/mtbflist", mtbflist);
			this._JSONModel.setProperty("/mtbflistSet", mtbflistSet);			
		},
		initLocationF4Help: function(){
			var that = this;
			var jsonModel = new JSONModel();
			var jUrl = "/destinations/S4HANACLOUD_BASIC/YY1_FUNCTIONALLOCATION_CDS/YY1_FunctionalLocation";
			var filterParameter = "$filter=(CompanyCode eq '1330' and MainWorkCenter eq 'M001')";
			var selectParameter = "$select=FunctionalLocation,FuncLocationStructure&$orderby=FunctionalLocation";
			var query =filterParameter+"&"+selectParameter;
			jsonModel.attachRequestCompleted(function(){
				var result = this.getProperty("/d/results");
				var obj = {};
				result = result.reduce(function(item, next) {
				      obj[next.FunctionalLocation] ? '' : obj[next.FunctionalLocation] = true && item.push(next);
				      return item;
				   }, []);				
				that._JSONModel.setProperty("/locationF4Set",result);
				sap.ui.getCore().byId("ZLOCATION_TTable").setBusy(false);
			});
			jsonModel.loadData(jUrl,query,true);
			if(!this._LocDialog){
				this._LocDialog = sap.ui.xmlfragment("cie.MTBF.dialog.location", this);
				designMode.syncStyleClass(this.getView(), this._LocDialog);
				this.getView().addDependent(this._LocDialog);
				sap.ui.getCore().byId("ZLOCATION_TTable").setBusy(true);
			}			
		},
		//******************************************************************************//	
		openLocation :function(){
			this._LocDialog.open();
		},
		onCancelAction:function(){
			this._LocDialog.close();	
		},
		// 所有搜索帮助进行本地的过滤
		onLocF4Search : function(evt){
			var aFilters = [];
			var query = evt.getSource().getValue();
			var queryId = evt.getParameter("id");
			var QueryValue = queryId.split("-");
			if(query && query.length > 0){
				var afilter = [];
				var i;
				for(i=0;i<QueryValue.length;i++){
					afilter.push(new Filter(QueryValue[i],FilterOperator.Contains, query));				
				}
				var allFilters = new Filter(afilter, false);// false为并集
				aFilters.push(allFilters);
			}
			var binding =  this._LocDialog.getContent()[0].getContent()[1].getBinding("items");
			binding.filter(aFilters);
		},
		onConfirmAction : function(){
			var oMultiInput1 = this.getView().byId("FuncLocation");
			var dataArr =this._LocDialog.getContent()[0].getContent()[1].getSelectedItems();
			if(dataArr.length === 0){
				messages.showText( "No data Seletecd" );
				return;
			}else{
				for(var i=0;i<dataArr.length;i++){
				var text = 	dataArr[i].mAggregations.cells[0].mProperties.text;
				// oMultiInput1.addToken(new Token({key: text, text: text}));
				this.byId("FuncLocation").setValue(text);				
					
				}
			}
			this.onCancelAction();
		},				
		//******************************************************************************//	
		// On Press Search
		onSearch: function(){
			var that = this;
			that.byId("table").setBusy(true);		
			that._JSONModel.setProperty("/priceListItemSet", []);			
			var sUrl = "/YY1_EquipmentData";
			var oDataUrl = "/destinations/S4HANACLOUD_BASIC/YY1_EQUIPMENTDATA_CDS";
			var ODataModel = new sap.ui.model.odata.ODataModel(oDataUrl);				
			var FuncLocation = that.byId("FuncLocation").getValue();
			var target = that.byId("target").getValue();	
			var productionTime = that.byId("productionTime").getValue();
			var i,k;
			that._JSONModel.setProperty("/target",target);			
			that._JSONModel.setProperty("/productionTime",productionTime);
			if (!FuncLocation) {
				that.byId("table").setBusy(false);					
				MessageToast.show("Please input Functional Location！");
				return;
			}	
			if(!productionTime){
				that.byId("table").setBusy(false);					
				MessageToast.show("Please input Production Time！");
				return;				
			}
			var allFilters = [];	
			allFilters.push(
				new Filter({
					path:"MainWorkCenter",
					operator: FilterOperator.EQ,
					value1: "M001"
				})				
				);						
			allFilters.push(
				new Filter({
					path:"FunctionalLocation",
					operator: FilterOperator.EQ,
					value1: FuncLocation
				})				
				);						
			/* eslint-disable sap-no-ui5base-prop */			
			// if(FuncLocation.length>0){
			// 	// for(i=0;i<FuncLocation.length;i++){
			// 	// 	// allFilters.push(new Filter('FunctionalLocation', FilterOperator.EQ, FuncLocation));
			// 	// }
			// }	
			/* eslint-disable sap-no-ui5base-prop */			
			var mParameters = {
				filters: allFilters,
				success: function (oData) {
					that.byId("table").setBusy(false);					
					var Arry = [];
					if (oData.results.length > 0) {
						for(var i=0;i<oData.results.length;i++){
							Arry.push(oData.results[i].Equipment);
						}
						that.unique(Arry);					
						that._JSONModel.setProperty("/equipmentSet",Arry);
						that.getDowntime();
					} else {
						that.mbtfChatsInit([],[]);							
						messages.showText("No Data!");
						return;
					}
				},
				error: function (oError) {
					that.byId("table").setBusy(false);
					messages.showODataErrorText(oError);
				}
			};
			ODataModel.read(sUrl, mParameters);				
		},
		getDowntime: function(Arry){
			var that = this;
			that.byId("table").setBusy(true);
			var sUrl = "/YY1_MachineDowntimeAnalysi";
			var oDataUrl = "/destinations/S4HANACLOUD_BASIC/YY1_MACHINEDOWNTIMEANALYSI_CDS";
			var ODataModel = new sap.ui.model.odata.ODataModel(oDataUrl);				
			var FuncLocation = that.byId("FuncLocation").getValue();
			var downDate = that.byId("downDate").getValue();			
			var allFilters = [];
			var i,k;
			var allFilters = [
					new Filter({
						path:"FunctionalLocation",
						operator: FilterOperator.EQ,
						value1: "FuncLocation"
					})				
				];				
			if (downDate){
				var downtimeDateArr = downDate.split(" ");
				var startDate = downtimeDateArr[0] + 'T00:00:00';
				var endDate = downtimeDateArr[2] + 'T23:59:59';
				allFilters.push(
					new Filter({
						path:"MalfunctionStartDate",
						operator: FilterOperator.LE,
						value1: endDate
					})				
					);
				allFilters.push(
					new Filter({
						path:"MalfunctionEndDate",
						operator: FilterOperator.GE,
						value1: startDate
					})				
					);					
				that._JSONModel.setProperty("/fromDate",downtimeDateArr[0]);
				that._JSONModel.setProperty("/toDate",downtimeDateArr[2]);
			}
			var mParameters = {
				filters: allFilters,
				// urlParameters: mUrlParameter,				
				success: function (oData) {
					that.byId("table").setBusy(false);
					var Arry  = oData.results;
					if (Arry) {
						that.sumDowntime(Arry);						
					}
				},
				error: function (oError) {
					that.byId("table").setBusy(false);
					messages.showODataErrorText(oError);
				}
			};
			ODataModel.read(sUrl, mParameters);		
		
		},
		// sum total Downtime
		sumDowntime: function(Arry){
			var equipArry = this._JSONModel.getProperty("/equipmentSet");
			var target = this._JSONModel.getProperty("/target");
			var productionTime = this._JSONModel.getProperty("/productionTime");
			var fromDate = this._JSONModel.getProperty("/fromDate");
			var toDate = this._JSONModel.getProperty("/toDate");
			var mbftlistSet = [];
			var yAdata = [];
			var i,k;
			for(i=0;i<equipArry.length;i++){
				var mbftlist = {};
				var count = 0;
				mbftlist.downTime = 0;
				mbftlist.equipment = equipArry[i]; 
				mbftlist.yearMonth = fromDate.substring(0,7);				
				for(k=0;k<Arry.length;k++){
					if(equipArry[i]===Arry[k].Equipment){
						count++;
						var startTime = Arry[k].MalfunctionStartTime.replace(/[^\d^]+/g,'');
							startTime = this.formatter.timeString(startTime);						
						var endTime = Arry[k].MalfunctionEndTime.replace(/[^\d^]+/g,'');
							endTime = this.formatter.timeString(endTime);
						var MalfunctionStartTime = this.formatter.date(Arry[k].MalfunctionStartDate)+" "+startTime;
						var MalfunctionEndTime = this.formatter.date(Arry[k].MalfunctionEndDate)+" "+endTime;
						fromDate = fromDate+" "+"23:59:59";
						toDate = toDate+" "+"23:59:59";
						/*eslint no-new-wrappers: "error"*/						
						var minute = 0;
						var currentDate = this.getNowFormatDate(" ");	
						// if CurrentDate low selected end Date
						if(!this.getJugeDate(currentDate,toDate)){
							toDate = currentDate;
						}
						minute = this.toCalMinute(MalfunctionStartTime,MalfunctionEndTime,fromDate,toDate,minute);
						mbftlist.downTime += minute;        
					}
				}
				var frenquency = count>0?count:1;
				mbftlist.frenquency = count;
				mbftlist.productionTime = productionTime;
				mbftlist.target = target;
				mbftlist.MTBF = Math.round((mbftlist.productionTime - mbftlist.downTime)/frenquency);
				mbftlistSet.push(mbftlist);
				yAdata.push(mbftlist.MTBF);
			}
			this._JSONModel.setProperty("/mtbflistSet",mbftlistSet);
			this.mbtfChatsInit(equipArry,yAdata);
		},
		// 计算分钟
		toCalMinute: function(malStartDate,malEndDate,startDate,endDate,num){
			var a = this.getJugeDate(malStartDate,startDate);
			var b = this.getJugeDate(malEndDate,endDate);
			var regString = /[a-zA-Z]+/;			
			var fromDate = this._JSONModel.getProperty("/fromDate");				
				fromDate = fromDate+" "+"00:00:00";
			// 在选择日期范围内
			if(!b&&!regString.test(malEndDate)){
				// return num;
				return this.getDateDiff(malStartDate,malEndDate,"minute")				
			}else if((b||(!b&&regString.test(malEndDate)))&&!a){
				return this.getDateDiff(malStartDate,endDate,"minute");			
			}else if((b||(!b&&regString.test(malEndDate)))&&a){
				return this.getDateDiff(fromDate,endDate,"minute");	
			}
		},
		getmonth: function(date){
			 var year=date.getFullYear(); 
			 var month=date.getMonth()+1;
			 month =(month<10 ? "0"+month:month); 
			 return (year.toString()+month.toString());					
		},		
		// Chat Init
		mbtfChatsInit: function(xAdata,yAdata){
			var myChart = null;
				this.id = this.createId("MTBFChart");
				var oView = document.getElementById(this.id);
				var height = $(window).height();
				var width = $(window).width();
				var target = this._JSONModel.getProperty("/target");
				var xRotate = yAdata.length>20?45:0;
				for(var i=0;i<yAdata.length;i++){
					if(!max){
					  var max = target>yAdata[i]?target:yAdata[i];						
					}else{
					      max = target>max?target:max;	
					      max = max>yAdata[i]?max:yAdata[i];
					}
				}				
				if(myChart !== null && myChart !== "" && myChart !== undefined) {
					myChart.dispose();
				}
				$('#'+ this.id).css('height',330);
		    	$('#'+ this.id).css('width',$(window).width()*0.985);
				var myChart = echarts.init(oView);
				    myChart.clear();
		    	if(xAdata.length == 0){
					return ;
				}
				if(!target){
					target = 0;
				}
				var option;
				option = {
				    title: {
				        text: 'MTBF(min)',
				        textStyle: {
				            color: '#3D3D3D',
				            fontSize: 18,
				            textAlign: 'center'
				        }
				    },
				    tooltip: {
				        trigger: 'axis',
				        axisPointer: {
				            type: 'shadow'
				        }
				    },
				    grid: {
				        left: '5%',
				        right: '5%',
				        bottom: '8%',
				        top: '15%',
				    },
				    xAxis: [{
				        type: 'category',
				        data: xAdata,
				        axisLine: {
				            show: true,
							rotate: xRotate,				            
				            lineStyle: {
				                color: "#666",
				                width: 1,
				                type: "solid"
				            }
				        },
				        axisTick: {
				            show: false,
				        },
				        axisLabel: {
				            show: true,
				
				            textStyle: {
				                color: "#666",
				            }
				        },
				    }],
				    yAxis: [{
				        type: 'value',
				        nameTextStyle: {
				            color: '#000'
				        },
				        offset: 0,
				        max: max,				        
				        axisLabel: {
				            formatter: '{value}',
				            color: '#666'
				        },
				        // interval: 500,
				        // max:3000,
				        axisTick: {
				            show: false,
				        },
				        axisLine: {
				            show: false
				        },        
				        splitLine: {
				            show: true,
				            lineStyle: {
				                color: "#CCCCCC",
				                width: 1,
				            }
				        }
				    }],
				    series: [
				    {
				        type: 'bar',
				        z: 10,
				        data: yAdata,
				        barWidth: 20,
				        barGap: 1,
				        itemStyle: {
				            normal: {
				                barBorderRadius: 0,
				                color: '#5865A8'
				            }
				        },
				        label: {
				            show: true,
				            position: 'top',
				            textStyle: {
				                color: '#3D3D3D'
				            },
				            formatter: '{c}'
				        },
				        markLine:{
				            silent: false,
				            symbol: "none",
				            label: {
				                position: "middle",
				                formatter: "{b}"
				            },
				            data: [{
				                name: "Target",
				                yAxis: target,
				                lineStyle: {
				                	// type: "solid",
				                    color: "#B34D4D"
				                },
				                label: {
				                    position: "end",
				                    formatter: "{b}\n {c}"
				                }
				            }]            
				        }				        
				    }]
				};
				myChart.clear();
	            if (option && typeof option === "object") {
	            	myChart.setOption(option, true);
	            	myChart.on('click', function (params) {
    				});
	            }			
		}		
		
	});
});