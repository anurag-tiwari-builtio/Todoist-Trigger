const request = require("request")

module.exports = {
	getSyncData: function (accessToken, resources, syncToken) {
		let URL = "https://todoist.com/api/v7/sync"

		let formData = {
			sync_token: syncToken || "*",
			resource_types: JSON.stringify(resources)
		}

		let extraHeaders = {
			"Content-Type": "application/x-www-form-urlencoded"
		}

		return this.makeHTTPRequest(
			"POST", URL, accessToken, this.JSONResponse, {}, extraHeaders, "form", formData
		)
	},

	getRequest: function (accessToken, entity, entityId, errorHandlerObject) {
		let URL = "https://beta.todoist.com/API/v8/" + entity + "/" + entityId

		return this.makeHTTPRequest("GET", URL, accessToken, this.JSONResponse, errorHandlerObject)
	},

	JSONResponse: function (error, response, body, resolveCallback, rejectCallback, errorHandlerObject) {
		let statusCode = response.statusCode
		if (!error) {
			switch (true) {
				case (statusCode == 200 && statusCode < 400):
					var parsedBody
					try {
						parsedBody = JSON.parse(body)
					} catch (error) {
						return rejectCallback("Unable to Parse Response")
					}
					resolveCallback(parsedBody)
					break
				case (statusCode == 400):
					rejectCallback("Bad Request")
					break
				case (statusCode == 401):
					rejectCallback("Authorization Error")
					break
				case (statusCode == 403):
					rejectCallback("Forbidden Error")
					break
				case (statusCode == 404):
					rejectCallback(errorHandlerObject && errorHandlerObject[404] || "Requested resource not found")
					break
				case (statusCode > 400 && statusCode < 500):
					rejectCallback("Unauthorized request sent by client")
					break
				case (statusCode == 500):
					rejectCallback("Internal Server Error")
					break
				case (statusCode == 503):
					rejectCallback("Service Unavialble Error")
					break
				case (statusCode == 504):
					rejectCallback("Request Timeout Error")
					break
				case (statusCode > 500):
					rejectCallback("Client Server Encountered an Error")
					break
				default:
					rejectCallback("Undefiend error please contact support team")
					break
			}
		} else {
			rejectCallback("error occured while making an request")
		}
	},

	// extraHeaders, postype, postData are the optional parameters
	makeHTTPRequest: function (
		method, url, accessToken, responseCallback, errorHandlerObject, extraHeaders, postType, postData
	) {
		let options = {}
		options["method"] = method
		options["url"] = url
		options["headers"] = {}

		if (extraHeaders) options["headers"] = extraHeaders
		options["headers"]["Authorization"] = "Bearer " + accessToken

		if (method != "GET") {
			options[postType] = postData
		}

		return new Promise((resolve, reject) => {
			request(options, (error, response, body) => {
				responseCallback(error, response, body, resolve, reject, errorHandlerObject)
			})
		})
	}
}