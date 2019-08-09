const request = require("request")
var lodash = require("lodash")

module.exports = {

	"name": "fetch_projects",

	"label": "Fetch Projects",

	"mock_input": {
		"auth": {}
	},
	"search": true,

	"execute": function (input, options, output) {
		var isSearch = false
		const MAXRESULTS = 10
		const startAt = input.page ? input.page * MAXRESULTS : 0

		if (!lodash.isEmpty(input.search)) {
			isSearch = true
		}
		else if (input.hasOwnProperty("search") && lodash.isEmpty(input.search)) {
			return output(null, { "results": [], "next_page": false })
		}

		request({
			method: "GET",
			url: "https://beta.todoist.com/API/v8/projects",
			headers: {
				Authorization: "Bearer " + input.auth.access_token,
			}
		}, function (error, response, body) {
			if (!error) {
				let statusCode = response.statusCode

				switch (true) {
					case (statusCode == 200 && statusCode < 400):
						var arr = []
						try {
							body = JSON.parse(body)

						} catch (error) {
							return output("Error while parsing body")
						}

						if (body && body.length > 0) {
							if (input.search) {
								var regexExp = new RegExp(lodash.escapeRegExp(input.search), "i")
								lodash.map(body, function (project) {
									if (regexExp.test(project.name)) {
										arr.push({
											id: String(project.id),
											value: project.name
										})
									}
								})
							} else {
								body.slice(startAt, startAt + MAXRESULTS).forEach((project) => {
									arr.push({
										id: String(project.id),
										value: project.name
									})
								})
							}
						}

						output(null, {
							results: arr,
							next_page: isSearch ? !isSearch : body.length > startAt + MAXRESULTS
						})
						break
					case (statusCode == 400):
						output("Bad Request")
						break
					case (statusCode == 401):
						output("Authorization Error")
						break
					case (statusCode == 403):
						output("Forbidden Error")
						break
					case (statusCode == 404):
						output("404 not found")
						break
					case (statusCode > 400 && statusCode < 500):
						output("Unauthorized request sent by client")
						break
					case (statusCode == 500):
						output("Internal Server Error")
						break
					case (statusCode == 503):
						output("Service Unavialble Error")
						break
					case (statusCode == 504):
						output("Request Timeout Error")
						break
					case (statusCode > 500):
						output("Client Server Encountered an Error")
						break
					default:
						output("Undefiend error please contact support team")
						break
				}
			} else {
				output(error)
			}
		})
	}
}