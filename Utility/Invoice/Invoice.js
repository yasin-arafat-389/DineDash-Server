const pdfMakePrinter = require("pdfmake");

function generateInvoice(invoiceData) {
  return new Promise((resolve, reject) => {
    const fonts = {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
      },
    };

    const printer = new pdfMakePrinter({
      Roboto: { normal: "Helvetica", bold: "Helvetica-Bold" },
    });

    const docDefinition = {
      content: [
        {
          columns: [
            {
              image: "public/dinedash.png",
              width: 80,
            },
            {
              text: "DineDash\n\nAddress: Mirpur, Dhaka\n\nPhone: 01993217969",
              fontSize: 12,
              alignment: "right",
            },
          ],
        },
        { text: "\n" },
        { text: "\n" },
        { text: "Invoice", fontSize: 18, alignment: "center" },
        { text: "\n" },
        { text: "\n" },
        {
          columns: [
            {
              text: `Date: ${getCurrentDate()}`,
              fontSize: 12,
              alignment: "left",
            },
            {
              text: `Email: ${invoiceData.email}\n\nPhone: ${invoiceData.phone}\n\nAddress: ${invoiceData.address}`,
              fontSize: 12,
              alignment: "right",
            },
          ],
        },
        { text: "\n" },
        { text: "\n" },
        { text: "Order Summary:", fontSize: 14 },
        { text: "\n" },
        ...(invoiceData.cartFood.length > 0
          ? [
              { text: "\n" },
              {
                table: {
                  headerRows: 1,
                  widths: ["*", "*", "*", "*", "*"],
                  body: [
                    [
                      "Item",
                      "Quantity",
                      "Unit Price",
                      "Restaurant",
                      "Total Price",
                    ],
                    ...(invoiceData.cartFood.length > 0
                      ? invoiceData.cartFood.map((item) => [
                          item.name,
                          item.quantity,
                          `${item.price}.00 taka`,
                          item.restaurant,
                          `${item.totalPrice}.00 taka`,
                        ])
                      : []),
                  ],
                },
                fontSize: 12,
                layout: "lightHorizontalLines",
              },
              { text: "\n" },
            ]
          : []),
        { text: "\n" },
        ...(invoiceData.burger.length > 0
          ? [
              { text: "\n" },
              {
                table: {
                  headerRows: 1,
                  widths: ["*", "*", "*", "*"],
                  body: [
                    ["Item", "Quantity", "Provider", "Total Price"],
                    ...(invoiceData.burger
                      ? invoiceData.burger.map((item) => [
                          "Custom Made Burger",
                          "1",
                          item.provider,
                          `${item.totalPrice} taka`,
                        ])
                      : []),
                  ],
                },
                fontSize: 12,
                layout: "lightHorizontalLines",
              },
              { text: "\n" },
            ]
          : []),
        { text: "\n" },
        {
          text: `Delivery Charge: ${invoiceData.deliveryCharge}.00 taka`,
          fontSize: 12,
        },
        { text: "\n" },
        {
          text: `Total Amount: ${invoiceData.orderTotal}.00 taka`,
          fontSize: 14,
          alignment: "right",
        },
        { text: "\n" },
        { text: "\n" },
        { text: "\n" },
        {
          text: "Thank you for ordering from DineDash.",
          fontSize: 12,
          alignment: "center",
        },
      ],
      styles: {
        tableExample: {
          margin: [0, 5, 0, 15],
        },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition, { fonts });

    const buffers = [];
    pdfDoc.on("data", (chunk) => {
      buffers.push(chunk);
    });

    pdfDoc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    pdfDoc.end();
  });

  function getCurrentDate() {
    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, "0");
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const year = String(currentDate.getFullYear());
    return `${day}/${month}/${year}`;
  }
}

module.exports = { generateInvoice };
