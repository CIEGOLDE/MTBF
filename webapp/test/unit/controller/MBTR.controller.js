/*global QUnit*/

sap.ui.define([
	"cie/MBTR/controller/MBTR.controller"
], function (Controller) {
	"use strict";

	QUnit.module("MBTR Controller");

	QUnit.test("I should test the MBTR controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});